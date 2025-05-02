import * as qs from 'query-string';

const trackableParams = [/^GCLID$/, /^promo_name$/, /^utm_.+$/];
const trackableParamsRegExp = new RegExp(
  `(${trackableParams.map(x => x.source).join('|')})`
);

const isUTM = (str: string) => /^utm_.*$/.test(str);

const lsKey = 'sentryUTMTouches';

const toFirstTouchKey = (utm: string) => `ft_${utm}__c`;
const toLastTouchKey = (utm: string) => `lt_${utm}__c`;

type UTMState = {
  data: Record<string, string>;
  touches: Record<string, string>;
  trackableQuery: Record<string, string>;
};

export function getUTMState(): UTMState {
  const query = qs.parse(window.location.search);
  const trackableQuery: Record<string, string> = Object.keys(query).reduce((a, k) => {
    return trackableParamsRegExp.test(k) && !!query[k] ? {...a, [k]: query[k]} : a;
  }, {});

  // Add trackable query params from the url to the form payload
  let extraData = Object.keys(trackableQuery).reduce((a, k) => {
    // The UTM fields have a suffix we have to add.
    const formName = isUTM(k) ? `${k}__c` : k;
    return {...a, [formName]: trackableQuery[k]};
  }, {});

  // Add the saved touch data to the form payload
  let touches: Record<string, string> = {};
  try {
    const saved = localStorage.getItem(lsKey);
    if (saved) {
      touches = JSON.parse(saved);
    }
  } catch (error) {
    // Noop, we don't care
  }
  extraData = {
    ...extraData,
    ...Object.keys(trackableQuery)
      .filter(isUTM)
      .reduce(
        (a, utm) => {
          // Send the first touch as the saved first touch or this one.
          const ftk = toFirstTouchKey(utm);
          const firstTouch = touches[ftk] || trackableQuery[utm];

          if (!firstTouch) {
            return a;
          }

          a[ftk] = firstTouch;

          // If a last touch is safed, send it.
          const ltk = toLastTouchKey(utm);
          if (touches[ltk]) {
            a[ltk] = touches[ltk];
          }
          return a;
        },
        {} as Record<string, string>
      ),
  };
  return {
    data: extraData,
    trackableQuery,
    touches,
  };
}
