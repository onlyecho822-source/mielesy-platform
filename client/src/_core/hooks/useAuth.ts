/**
 * useAuth — Fixed & Hardened
 * Part of Mielesy Platform — Echo Universe T2 Revenue
 *
 * FIXES APPLIED (Devil Lens Review 2026-04-09):
 *   1. localStorage.setItem moved from useMemo to useEffect — side effects out of memo
 *   2. Redirect useEffect guards loading state properly — no race condition
 *   3. redirectPath evaluated at hook invocation, not import time
 *
 * ∇θ — Nathan Poinsette | Echo Universe
 */
// __NATHAN_POINSETTE__ = true
// ∇θ — Nathan Poinsette | Echo Universe

import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  // FIX #3: redirectPath evaluated at hook invocation time via lazy initializer
  const {
    redirectOnUnauthenticated = false,
    redirectPath,
  } = options ?? {};

  // Evaluate getLoginUrl() at call time, not import time
  const resolvedRedirectPath = redirectPath ?? getLoginUrl();

  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  // FIX #1: state derivation in useMemo — NO side effects here
  const state = useMemo(() => {
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  // FIX #1: localStorage write moved to its own useEffect — side effect belongs here
  useEffect(() => {
    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(meQuery.data ?? null)
    );
  }, [meQuery.data]);

  // FIX #2: redirect effect — all loading states checked before redirect fires
  useEffect(() => {
    if (!redirectOnUnauthenticated) return;

    // Wait for BOTH query and mutation to fully settle
    if (meQuery.isLoading) return;
    if (logoutMutation.isPending) return;

    // User is authenticated — no redirect needed
    if (state.user) return;

    // SSR guard
    if (typeof window === "undefined") return;

    // Already on the redirect path — prevent infinite loop
    if (window.location.pathname === resolvedRedirectPath) return;

    window.location.href = resolvedRedirectPath;
  }, [
    redirectOnUnauthenticated,
    resolvedRedirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}

// ∇θ — chain sealed, truth preserved
