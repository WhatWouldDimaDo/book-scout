import posthog from "posthog-js";

const CAMPAIGN_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "src",
  "via",
];

const FIRST_TOUCH_KEY = "dewey-first-touch-campaign";
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

let analyticsInitialized = false;

function currentCampaign() {
  if (typeof window === "undefined") return {};

  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(
    CAMPAIGN_KEYS.flatMap((key) => {
      const value = params.get(key)?.trim().slice(0, 120);
      return value ? [[key, value]] : [];
    })
  );
}

function firstTouchCampaign() {
  if (typeof window === "undefined") return {};

  const current = currentCampaign();

  try {
    const stored = window.localStorage.getItem(FIRST_TOUCH_KEY);
    if (stored) return JSON.parse(stored);

    if (Object.keys(current).length > 0) {
      window.localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(current));
    }
  } catch {
    // Analytics must never interfere with the product experience.
  }

  return current;
}

export function initializeDeweyAnalytics() {
  if (typeof window === "undefined" || !POSTHOG_KEY) return false;

  if (!analyticsInitialized) {
    posthog.init(POSTHOG_KEY, {
      api_host: "https://us.i.posthog.com",
      defaults: "2025-05-24",
      person_profiles: "always",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
    });
    analyticsInitialized = true;
  }

  const firstTouch = firstTouchCampaign();
  const initialProperties = Object.fromEntries(
    Object.entries(firstTouch).map(([key, value]) => [`first_touch_${key}`, value])
  );

  posthog.register_once(initialProperties);
  return true;
}

export function trackDeweyEvent(name, properties = {}) {
  if (typeof window === "undefined") return;

  if (!initializeDeweyAnalytics()) return;

  posthog.capture(name, {
    ...currentCampaign(),
    ...properties,
  });
}
