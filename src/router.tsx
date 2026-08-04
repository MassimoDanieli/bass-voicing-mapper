import { useSyncExternalStore, type MouseEvent, type ReactNode } from "react";

export const ROUTES = ["/", "/repertoire", "/songs", "/help"] as const;
export type Route = (typeof ROUTES)[number];

/**
 * Unknown or malformed paths resolve to the instrument rather than a dead end:
 * the Worker serves index.html for everything, so a typo must not blank the page.
 */
export function matchRoute(pathname: string): Route {
  const normalized = `/${pathname.replace(/^\/+|\/+$/g, "")}`.toLowerCase();
  return (ROUTES as readonly string[]).includes(normalized) ? (normalized as Route) : "/";
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

export function navigate(to: Route) {
  if (window.location.pathname === to) return;
  window.history.pushState(null, "", to);
  window.scrollTo({ top: 0 });
  for (const listener of listeners) listener();
}

export function useRoute(): Route {
  return matchRoute(
    useSyncExternalStore(subscribe, () => window.location.pathname, () => "/"),
  );
}

export function Link({
  to,
  children,
  className,
}: {
  to: Route;
  children: ReactNode;
  className?: string;
}) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Leave modified clicks alone so "open in new tab" keeps working.
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to);
  };

  return (
    <a href={to} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
