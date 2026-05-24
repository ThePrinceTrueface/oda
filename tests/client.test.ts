import { describe, it, expect, vi } from 'vitest';
import oda from '../src/index';
import { OdaEngine } from '../src/engine';

describe('OdaHttpClient', () => {
  it('should perform a successful GET request', async () => {
    // 1. Mock engine
    const mockEngine: OdaEngine = {
      execute: vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        ok: true,
        url: 'https://api.example.com/test',
        json: async () => ({ foo: 'bar' }),
        text: async () => JSON.stringify({ foo: 'bar' }),
      }),
    };

    // 2. Setup client
    const client = oda.http.client('https://api.example.com', { engine: mockEngine });

    // 3. Execute
    const res = await client.get<{ foo: string }>('/test');

    // 4. Assert
    expect(res.isSuccess()).toBe(true);
    expect(res.data()).toEqual({ foo: 'bar' });
    expect(res.status()).toBe(200);
    expect(mockEngine.execute).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      url: 'https://api.example.com/test',
    }));
  });

  it('should handle HTTP errors without throwing', async () => {
    const mockEngine: OdaEngine = {
      execute: vi.fn().mockResolvedValue({
        status: 404,
        statusText: 'Not Found',
        headers: { 'content-type': 'application/json' },
        ok: false,
        url: 'https://api.example.com/404',
        json: async () => ({ error: 'Not Found' }),
        text: async () => JSON.stringify({ error: 'Not Found' }),
      }),
    };

    const client = oda.http.client('https://api.example.com', { engine: mockEngine });
    const res = await client.get('/404');

    expect(res.isError()).toBe(true);
    expect(res.status()).toBe(404);
    expect(res.data()).toEqual({ error: 'Not Found' });
  });

  it('should handle timeouts', async () => {
    const mockEngine: OdaEngine = {
      execute: () => new Promise((resolve) => setTimeout(resolve, 100)),
    };

    const client = oda.http.client('https://api.example.com', { 
      engine: mockEngine,
      defaultTimeout: 10 // Very short timeout
    });

    const res = await client.get('/slow');

    expect(res.isError()).toBe(true);
    expect(res.error()?.name).toBe('OdaTimeoutError');
  });
});
