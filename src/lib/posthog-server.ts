import type { AstroCookies } from 'astro';
import { PostHog } from 'posthog-node';
import { getSessionUserId } from './auth';

let posthogClient: PostHog | null | undefined;

function getPostHogServer(): PostHog | null {
  if (posthogClient !== undefined) return posthogClient;

  const projectToken = import.meta.env.PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = import.meta.env.PUBLIC_POSTHOG_HOST;
  if (!projectToken) {
    if (import.meta.env.DEV) {
      throw new Error('PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once PUBLIC_POSTHOG_PROJECT_TOKEN is configured');
    }
    posthogClient = null;
    return posthogClient;
  }
  if (!host) {
    if (import.meta.env.DEV) {
      throw new Error('PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once PUBLIC_POSTHOG_HOST is configured');
    }
    posthogClient = null;
    return posthogClient;
  }

  posthogClient = new PostHog(projectToken, {
    host,
    flushAt: 1,
    flushInterval: 0,
    enableExceptionAutocapture: true,
  });
  return posthogClient;
}

export async function captureAdminEvent(
  cookies: AstroCookies,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const userId = getSessionUserId(cookies);
  const posthog = getPostHogServer();
  if (!userId || !posthog) return;

  try {
    posthog.capture({
      distinctId: `admin:${userId}`,
      event,
      properties,
    });
    await posthog.flush();
  } catch (error) {
    console.error('Failed to capture PostHog admin event:', error);
  }
}
