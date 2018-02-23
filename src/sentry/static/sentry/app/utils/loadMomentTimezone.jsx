export default function loadMomentTimezone() {
  return import(/*webpackChunkName: "moment-timezone" */ 'moment-timezone').then(
    module => module.tz
  );
}
