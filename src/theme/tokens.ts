/**
 * Design tokens — the raw values. Nothing here references light/dark.
 *
 * Rule of thumb: components must never import from this file directly.
 * They consume semantic colors via useTheme(), so that swapping the palette
 * (or adding a third theme) is a one-file change.
 */

export const palette = {
  // Brand
  indigo50: '#EEF2FF',
  indigo100: '#E0E7FF',
  indigo400: '#818CF8',
  indigo500: '#6366F1',
  indigo600: '#4F46E5',
  indigo700: '#4338CA',

  // Neutrals
  white: '#FFFFFF',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  gray950: '#030712',
  black: '#000000',

  // Status
  red100: '#FEE2E2',
  red500: '#EF4444',
  red600: '#DC2626',
  green100: '#DCFCE7',
  green500: '#22C55E',
  green600: '#16A34A',
  amber100: '#FEF3C7',
  amber500: '#F59E0B',
  blue500: '#3B82F6',

  transparent: 'transparent',
} as const;

/** 4pt grid. Using a scale instead of magic numbers keeps rhythm consistent. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

export const typography = {
  size: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  /**
   * Line heights as absolute numbers rather than multipliers: React Native's
   * `lineHeight` is in points, and multiplying at render time causes
   * sub-pixel text jitter across platforms.
   */
  lineHeight: {
    xs: 16,
    sm: 20,
    base: 24,
    lg: 28,
    xl: 28,
    xxl: 32,
    xxxl: 40,
  },
} as const;

export const duration = {
  fast: 150,
  base: 250,
  slow: 400,
} as const;

export type Spacing = keyof typeof spacing;
export type Radius = keyof typeof radius;
export type FontSize = keyof typeof typography.size;
