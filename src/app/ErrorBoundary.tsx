/**
 * Top-level error boundary.
 *
 * React only catches render/lifecycle errors in class components — hooks
 * cannot do this — so this stays a class. Without it, one render error unmounts
 * the whole tree and the user is left staring at a white screen.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Text } from '../components/Text';
import { env } from '../config/env';
import { captureError } from '../services/monitoring/sentry';

type Props = {
  children: React.ReactNode;
  /** Rendered instead of the default UI. Receives a reset callback. */
  fallback?: (props: { error: Error; reset: () => void }) => React.ReactNode;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    captureError(error, {
      componentStack: errorInfo.componentStack,
      source: 'ErrorBoundary',
    });
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): React.ReactNode {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (!error) return children;
    if (fallback) return fallback({ error, reset: this.reset });

    return (
      <View style={styles.container}>
        <Text variant="title" style={styles.title}>
          This screen ran into a problem
        </Text>
        <Text tone="secondary" style={styles.body}>
          The error has been reported. You can try again, or restart the app if it keeps
          happening.
        </Text>

        {/* Never show a stack trace in production — it leaks internals. */}
        {env.isProd ? null : (
          <View style={styles.debugBox}>
            <Text variant="caption" tone="danger">
              {error.name}: {error.message}
            </Text>
          </View>
        )}

        <Button title="Try again" onPress={this.reset} style={styles.button} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  // Deliberately theme-free: the boundary must render even when the failure
  // came from the theme provider itself.
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  title: { textAlign: 'center', marginBottom: 8, color: '#111827' },
  body: { textAlign: 'center', marginBottom: 24, color: '#4B5563' },
  debugBox: {
    alignSelf: 'stretch',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    marginBottom: 24,
  },
  button: { alignSelf: 'stretch' },
});
