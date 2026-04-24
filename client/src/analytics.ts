import posthog from "posthog-js";

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com";

export function initAnalytics() {
  if (!posthogKey) {
    return;
  }

  posthog.init(posthogKey, {
    api_host: posthogHost,
    autocapture: false,
    capture_pageview: true
  });
}

export function captureEvent(eventName: string, properties?: Record<string, unknown>) {
  if (!posthogKey) {
    return;
  }

  posthog.capture(eventName, properties);
}
