import React, { useEffect, useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import type { EmblaOptionsType } from "embla-carousel";
import { useAutoplay } from "../utils/useAutoPlay";

type Post =
  | { id: string; type: "single"; image: string }
  | { id: string; type: "carousel"; images: string[] }
  | { id: string; type: "video"; src: string };

type PropType = {
  slides?: Post[];
  options?: EmblaOptionsType;
};

export function EmblaCarousel({ slides, options }: PropType) {
  // example slides fallback
  const defaultSlides: Post[] = [
    { id: "1", type: "single", image: "/img/1.png" },
    {
      id: "2",
      type: "carousel",
      images: ["/img/1.png", "/img/2.png", "/img/3.png"],
    },
    { id: "3", type: "video", src: "/img/vid1.mp4" },
    { id: "4", type: "single", image: "/img/2.png" },
    { id: "5", type: "single", image: "/img/3.png" },
  ];
  const posts = slides ?? defaultSlides;

  options = { loop: true, ...options };
  // main/autoplay embla
  const autoplayPlugin = Autoplay({ playOnInit: true, delay: 3000 });
  const [emblaRef, emblaApi] = useEmblaCarousel(options, [autoplayPlugin]);

  // helper from your project that toggles the autoplay plugin — keep using it
  const { autoplayIsPlaying, toggleAutoplay } = useAutoplay(emblaApi);

  // when a nested item is hovered we want to pause the outer autoplay.
  // provide callbacks to children; they call these on enter/leave.
  const handleNestedHoverStart = () => {
    // try to use your hook toggleAutoplay to pause outer playback if it's playing
    if (autoplayIsPlaying) toggleAutoplay();
  };
  const handleNestedHoverEnd = () => {
    // resume outer autoplay if it was paused
    if (!autoplayIsPlaying) toggleAutoplay();
  };

  return (
    <div className="embla" ref={emblaRef}>
      <div className="embla__container flex gap-8">
        {posts.map((post, index) => (
          <div
            className="embla__slide"
            key={post.id}
            style={index === 0 ? { marginLeft: "32px" } : undefined}
          >
            <PostItem
              post={post}
              onNestedHoverStart={handleNestedHoverStart}
              onNestedHoverEnd={handleNestedHoverEnd}
            />
          </div>
        ))}
      </div>

      <button className="embla__play" onClick={toggleAutoplay} type="button">
        {autoplayIsPlaying ? "Stop" : "Start"}
      </button>
    </div>
  );
}

function PostItem({
  post,
  onNestedHoverStart,
  onNestedHoverEnd,
}: {
  post: Post;
  onNestedHoverStart: () => void;
  onNestedHoverEnd: () => void;
}) {
  // common wrapper size like Instagram post card
  const wrapperStyle = "w-[460px] h-[610px] overflow-hidden rounded-lg";

  if (post.type === "single") {
    return (
      <div className={`${wrapperStyle} bg-gray-100`}>
        <img
          src={post.image}
          alt=""
          className="w-full h-full object-cover"
          // make sure clicks/drags on the image don't bubble to parent embla
          onPointerDown={(e) => e.stopPropagation()}
        />
      </div>
    );
  }

  if (post.type === "carousel") {
    return (
      <div className={wrapperStyle}>
        <InnerCarousel
          images={post.images}
          onHoverStart={onNestedHoverStart}
          onHoverEnd={onNestedHoverEnd}
        />
      </div>
    );
  }

  // video
  return (
    <div className={wrapperStyle}>
      <VideoPost
        src={post.src}
        onHoverStart={onNestedHoverStart}
        onHoverEnd={onNestedHoverEnd}
      />
    </div>
  );
}

/**
 * InnerCarousel
 * - independent embla instance (no shared autoplay plugin)
 * - manages its own "autoplay while hovered" using a simple interval that calls scrollNext
 * - stops pointer events from bubbling to the parent embla so inner drag is isolated
 */
function InnerCarousel({
  images,
  interval = 2500,
  onHoverStart,
  onHoverEnd,
}: {
  images: string[];
  interval?: number;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const hoverIntervalRef = useRef<number | null>(null);
  const isHoveringRef = useRef(false);

  useEffect(() => {
    return () => {
      if (hoverIntervalRef.current) {
        window.clearInterval(hoverIntervalRef.current);
      }
    };
  }, []);

  const startAutoplay = () => {
    if (hoverIntervalRef.current) return;
    hoverIntervalRef.current = window.setInterval(() => {
      emblaApi?.scrollNext();
    }, interval);
    onHoverStart?.();
  };

  const stopAutoplay = () => {
    if (hoverIntervalRef.current) {
      window.clearInterval(hoverIntervalRef.current);
      hoverIntervalRef.current = null;
    }
    onHoverEnd?.();
  };

  return (
    <div
      className="embla inner-embla h-full"
      ref={emblaRef}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerEnter={() => {
        isHoveringRef.current = true;
        startAutoplay();
      }}
      onPointerLeave={() => {
        isHoveringRef.current = false;
        stopAutoplay();
      }}
    >
      <div className="embla__container flex gap-4 h-full">
        {images.map((src, i) => (
          <div
            key={i}
            className="embla__slide"
            style={{ width: "100%", flex: "0 0 100%" }}
          >
            <img
              src={src}
              alt=""
              className="w-full h-full object-cover"
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * VideoPost
 * - plays on hover, pauses on leave
 * - mutes and uses playsInline for mobile browsers
 * - prevents pointer events from bubbling so outer embla won't drag
 */
function VideoPost({
  src,
  onHoverStart,
  onHoverEnd,
}: {
  src: string;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    return () => {
      // ensure video is paused when component unmounts
      if (videoRef.current) {
        videoRef.current.pause();
      }
    };
  }, []);

  const handleEnter = () => {
    onHoverStart?.();
    const vid = videoRef.current;
    if (!vid) return;
    // try to play; modern browsers allow autoplay muted
    vid.muted = true;
    vid.play().catch(() => {
      // ignore play errors
    });
  };

  const handleLeave = () => {
    onHoverEnd?.();
    const vid = videoRef.current;
    if (!vid) return;
    vid.pause();
    vid.currentTime = 0;
  };

  return (
    <div
      className="w-full h-full bg-black flex items-center justify-center"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerEnter={handleEnter}
      onPointerLeave={handleLeave}
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-cover"
        playsInline
        muted
        loop
        // prevent native controls from causing parent embla drag when interacting
        onPointerDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}
// ...existing code...