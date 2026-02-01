'use client';

import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
          <Card className="max-w-md w-full bg-neutral-900 border-neutral-800">
            <CardHeader className="bg-red-950/30 rounded-t-2xl">
              <CardTitle className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-5 h-5" />
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <p className="text-neutral-300">
                An unexpected error occurred. Please try refreshing the page.
              </p>
              {this.state.error && (
                <pre className="text-xs text-red-400 bg-neutral-950 p-3 rounded-lg overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={this.handleReset}
                  className="bg-purple-600 hover:bg-purple-500 text-white"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try again
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => window.location.reload()}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100"
                >
                  Reload page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
