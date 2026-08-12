import * as Keychain from 'react-native-keychain';

import { secureStorage, type AuthTokens } from '../../src/services/storage/secureStorage';

const tokens: AuthTokens = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  expiresAt: Date.now() + 60_000,
};

beforeEach(async () => {
  await secureStorage.clearTokens();
  jest.clearAllMocks();
});

describe('secureStorage', () => {
  it('round-trips tokens through the keychain', async () => {
    await secureStorage.saveTokens(tokens);
    expect(await secureStorage.getTokens()).toEqual(tokens);
  });

  it('returns null when nothing is stored', async () => {
    expect(await secureStorage.getTokens()).toBeNull();
  });

  it('clears tokens', async () => {
    await secureStorage.saveTokens(tokens);
    await secureStorage.clearTokens();
    expect(await secureStorage.getTokens()).toBeNull();
  });

  it('discards a stored value whose shape no longer matches', async () => {
    // Simulates an app upgrade where the persisted token shape changed.
    (Keychain as unknown as { __setStored: (v: unknown) => void }).__setStored({
      username: 'tokens',
      password: JSON.stringify({ token: 'old-format' }),
    });

    expect(await secureStorage.getTokens()).toBeNull();
  });

  it('degrades to null instead of throwing when the keychain fails', async () => {
    // The implementation warns on purpose here; silence it so the expected
    // failure path doesn't look like a real problem in the test output.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    (Keychain.getGenericPassword as jest.Mock).mockRejectedValueOnce(
      new Error('User canceled the operation'),
    );

    await expect(secureStorage.getTokens()).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });

  describe('isExpired', () => {
    it('is false well before expiry', () => {
      expect(secureStorage.isExpired({ ...tokens, expiresAt: Date.now() + 120_000 })).toBe(false);
    });

    it('is true after expiry', () => {
      expect(secureStorage.isExpired({ ...tokens, expiresAt: Date.now() - 1000 })).toBe(true);
    });

    it('is true inside the clock-skew window', () => {
      // 10s left, default skew is 30s.
      expect(secureStorage.isExpired({ ...tokens, expiresAt: Date.now() + 10_000 })).toBe(true);
    });
  });
});
