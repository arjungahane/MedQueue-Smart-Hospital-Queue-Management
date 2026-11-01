export function orderWaitingTokens(tokens, policy) {
  const priorityFirst = [...tokens].sort((a, b) => {
    const priority = (b.priority ?? 0) - (a.priority ?? 0);
    if (priority) return priority;
    if (policy === 'LIFO') return new Date(b.registeredAt) - new Date(a.registeredAt);
    return new Date(a.registeredAt) - new Date(b.registeredAt);
  });
  return priorityFirst;
}

export function mm1Metrics(arrivalRate, serviceRate) {
  if (!Number.isFinite(arrivalRate) || !Number.isFinite(serviceRate) ||
      arrivalRate < 0 || serviceRate <= 0) {
    throw new RangeError('Arrival rate must be non-negative and service rate must be positive.');
  }
  if (arrivalRate >= serviceRate) {
    return { stable: false, arrivalRate, serviceRate, utilization: null, idleProbability: null,
      patientsInSystem: null, queueLength: null, timeInSystemHours: null, queueWaitHours: null };
  }
  const rho = arrivalRate / serviceRate;
  return {
    stable: true,
    arrivalRate,
    serviceRate,
    utilization: rho,
    idleProbability: 1 - rho,
    patientsInSystem: arrivalRate / (serviceRate - arrivalRate),
    queueLength: arrivalRate ** 2 / (serviceRate * (serviceRate - arrivalRate)),
    timeInSystemHours: 1 / (serviceRate - arrivalRate),
    queueWaitHours: arrivalRate / (serviceRate * (serviceRate - arrivalRate)),
  };
}
