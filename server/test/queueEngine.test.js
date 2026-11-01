import test from 'node:test';
import assert from 'node:assert/strict';
import { mm1Metrics, orderWaitingTokens } from '../src/services/queueEngine.js';

const tokens = [
  { id: 'first', priority: 0, registeredAt: new Date('2026-01-01T10:00:00Z') },
  { id: 'later', priority: 0, registeredAt: new Date('2026-01-01T10:05:00Z') },
  { id: 'priority', priority: 1, registeredAt: new Date('2026-01-01T10:08:00Z') },
];

test('FIFO prioritizes priority patients, then serves standard patients oldest first', () => {
  assert.deepEqual(orderWaitingTokens(tokens, 'FIFO').map((token) => token.id), ['priority', 'first', 'later']);
});

test('LIFO prioritizes priority patients, then serves standard patients newest first', () => {
  assert.deepEqual(orderWaitingTokens(tokens, 'LIFO').map((token) => token.id), ['priority', 'later', 'first']);
});

test('M/M/1 metrics match the stable model', () => {
  const metrics = mm1Metrics(2, 4);
  assert.equal(metrics.utilization, 0.5);
  assert.equal(metrics.idleProbability, 0.5);
  assert.equal(metrics.patientsInSystem, 1);
  assert.equal(metrics.queueLength, 0.5);
  assert.equal(metrics.timeInSystemHours, 0.5);
  assert.equal(metrics.queueWaitHours, 0.25);
});

test('M/M/1 unstable systems do not return misleading metrics', () => {
  assert.equal(mm1Metrics(4, 4).stable, false);
  assert.throws(() => mm1Metrics(-1, 4), RangeError);
});
