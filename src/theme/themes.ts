/**
 * Semantic themes built from the raw tokens.
 *
 * Every color a component uses has a *role* name (`bg.surface`, `text.muted`)
 * rather than a value name (`gray100`). That is what makes dark mode a data
 * change instead of a code change.
 */
import { palette, radius, spacing, typography, duration } from './tokens';

export type ThemeColors = {
  bg: {
    canvas: string;
    surface: string;
    surfaceRaised: string;
    inverse: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
    link: string;
  };
  border: {
    subtle: string;
    strong: string;
    focus: string;
  };
  brand: {
    solid: string;
    solidPressed: string;
    subtle: string;
    onSolid: string;
  };
  status: {
    danger: string;
    dangerSubtle: string;
    success: string;
    successSubtle: string;
    warning: string;
    warningSubtle: string;
    info: string;
  };
  /** Non-semantic passthroughs used by overlays and shadows. */
  overlay: string;
};

const lightColors: ThemeColors = {
  bg: {
    canvas: palette.gray50,
    surface: palette.white,
    surfaceRaised: palette.white,
    inverse: palette.gray900,
  },
  text: {
    primary: palette.gray900,
    secondary: palette.gray600,
    muted: palette.gray500,
    inverse: palette.white,
    link: palette.indigo600,
  },
  border: {
    subtle: palette.gray200,
    strong: palette.gray300,
    focus: palette.indigo500,
  },
  brand: {
    solid: palette.indigo600,
    solidPressed: palette.indigo700,
    subtle: palette.indigo50,
    onSolid: palette.white,
  },
  status: {
    danger: palette.red600,
    dangerSubtle: palette.red100,
    success: palette.green600,
    successSubtle: palette.green100,
    warning: palette.amber500,
    warningSubtle: palette.amber100,
    info: palette.blue500,
  },
  overlay: 'rgba(0, 0, 0, 0.45)',
};

const darkColors: ThemeColors = {
  bg: {
    canvas: palette.gray950,
    surface: palette.gray900,
    surfaceRaised: palette.gray800,
    inverse: palette.gray50,
  },
  text: {
    primary: palette.gray50,
    secondary: palette.gray300,
    muted: palette.gray400,
    inverse: palette.gray900,
    link: palette.indigo400,
  },
  border: {
    subtle: palette.gray800,
    strong: palette.gray700,
    focus: palette.indigo400,
  },
  brand: {
    solid: palette.indigo500,
    solidPressed: palette.indigo600,
    // Not indigo50 — a light tint on a dark canvas glares. Use a dark neutral
    // with a brand cast instead.
    subtle: '#1E1B4B',
    onSolid: palette.white,
  },
  status: {
    danger: palette.red500,
    dangerSubtle: '#450A0A',
    success: palette.green500,
    successSubtle: '#052E16',
    warning: palette.amber500,
    warningSubtle: '#451A03',
    info: palette.blue500,
  },
  overlay: 'rgba(0, 0, 0, 0.65)',
};

const shared = { spacing, radius, typography, duration } as const;

export const lightTheme = { name: 'light', colors: lightColors, ...shared } as const;
export const darkTheme = { name: 'dark', colors: darkColors, ...shared } as const;

export type Theme = typeof lightTheme | typeof darkTheme;
export type ThemeName = Theme['name'];

/** What the user picked. 'system' follows the OS appearance setting. */
export type ThemePreference = ThemeName | 'system';
