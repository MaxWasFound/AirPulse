import type { ScrollScrubScene, ScrollScrubTheme } from "@/components/scroll-scrub/scroll-scrub";

export const scrollScrubTheme: ScrollScrubTheme = {
  accent: "#B7F36B",
  background: "#101E1B",
  ink: "#F0F4E9",
  muted: "#9DAFA2",
};

export const scrollScrubScenes: ScrollScrubScene[] = [
  {
    body: "The air around us is always moving. AirPulse brings modelled readings, weather, and neighborhood observations into one clear picture, without confusing estimates with verified station measurements.",
    clip: "/assets/world/scene-01.mp4",
    id: "air-signal",
    kicker: "COMMUNITY AIR INTELLIGENCE",
    label: "The signal",
    mobileClip: "/assets/world/scene-01-mobile.mp4",
    mobilePoster: "/assets/world/scene-01-mobile-poster.png",
    poster: "/assets/world/scene-01-poster.png",
    tags: ["Live context", "Source-aware", "Community-led"],
    title: "Know the air.\nShare the signal.",
    scroll: 2.2,
    linger: 0.12,
  },
];
