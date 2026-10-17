// One number that says how close the plan is to launch, with every deduction listed.
export function readiness({ channelPlan, issues, tests, aiOk }) {
  const deductions = [];
  const take = (points, reason) => deductions.push({ points, reason });

  if (!aiOk) take(50, 'No ad copy: the AI step did not run, so only the channel and budget plan is ready.');
  if (channelPlan.underfunded) take(20, 'Budget is below the usual minimum for the chosen channel.');
  for (const n of channelPlan.notes) if (/break even|deal value/.test(n)) take(10, 'Forecast cost per sale or customer is above what it is worth.');

  const errors = issues.filter((i) => i.level === 'error');
  const warns = issues.filter((i) => i.level === 'warn');
  if (errors.length) take(Math.min(40, errors.length * 8), `${errors.length} copy problem${errors.length > 1 ? 's' : ''} that must be fixed before launch.`);
  if (warns.length) take(Math.min(15, warns.length * 3), `${warns.length} copy warning${warns.length > 1 ? 's' : ''} worth a second look.`);

  const blocked = tests.filter((t) => !t.feasible);
  if (blocked.length) take(Math.min(20, blocked.length * 10), `${blocked.length} A/B test${blocked.length > 1 ? 's' : ''} won't get enough traffic to give a clear answer.`);

  const score = Math.max(0, 100 - deductions.reduce((a, d) => a + d.points, 0));
  const level = score >= 80 ? 'ready' : score >= 60 ? 'review' : 'rework';
  return { score, level, deductions };
}

export const LEVEL_TEXT = { ready: 'Ready to launch', review: 'Review flagged items', rework: 'Needs rework' };
