import {DAY, HOUR, MINUTE, MONTH, SECOND, WEEK} from 'sentry/utils/formatters';

export function parseClockToSeconds(clock: string) {
  const [rest, milliseconds] = clock.split('.');
  const parts = rest!.split(':');

  let seconds = 0;
  const progression = [MONTH, WEEK, DAY, HOUR, MINUTE, SECOND].slice(parts.length * -1);
  for (let i = 0; i < parts.length; i++) {
    const num = Number(parts[i]) || 0;
    const time = progression[i]! / 1000;
    seconds += num * time;
  }
  const ms = Number(milliseconds) || 0;
  return seconds + ms / 1000;
}
