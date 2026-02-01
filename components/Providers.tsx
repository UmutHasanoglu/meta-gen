'use client';

import { ReactNode } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';

export function Providers({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
