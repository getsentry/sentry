import {Fragment, useEffect, useMemo, useState} from 'react';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

// const browsersListOutput = [
//   'chrome 111',
//   'chrome 110',
//   'chrome 109',
//   'chrome 108',
//   'chrome 107',
//   'chrome 106',
//   'chrome 105',
//   'chrome 104',
//   'chrome 103',
//   'chrome 102',
//   'edge 111',
//   'edge 110',
//   'firefox 111',
//   'firefox 110',
//   'firefox 109',
//   'firefox 108',
//   'firefox 107',
//   'firefox 106',
//   'firefox 105',
//   'firefox 104',
//   'firefox 103',
//   'firefox 102',
//   'ios_saf 16.4',
//   'ios_saf 16.3',
//   'ios_saf 16.2',
//   'ios_saf 16.1',
//   'ios_saf 16.0',
//   'ios_saf 15.6',
//   'ios_saf 15.5',
//   'ios_saf 15.4',
//   'ios_saf 15.2-15.3',
//   'ios_saf 15.0-15.1',
//   'ios_saf 14.5-14.8',
//   'ios_saf 14.0-14.4',
//   'op_mob 73',
//   'safari 16.4',
//   'safari 16.3',
//   'safari 16.2',
//   'safari 16.1',
//   'safari 16.0',
//   'safari 15.6',
//   'safari 15.5',
//   'safari 15.4',
//   'safari 15.2-15.3',
//   'safari 15.1',
//   'safari 15',
// ];

const packageJsonBrowsersList = {
  browserslist: {
    production: [
      'last 10 Chrome versions',
      'last 10 Firefox versions',
      'last 2 Edge major versions',
      'last 2 Safari major versions',
      'last 3 iOS major versions',
      'last 1 OperaMobile version',
      'Firefox ESR',
    ],
    development: [
      'last 10 Chrome versions',
      'last 10 Firefox versions',
      'last 2 Edge major versions',
      'last 2 Safari major versions',
      'last 3 iOS major versions',
      'last 1 OperaMobile version',
      'Firefox ESR',
    ],
    test: ['current node'],
  },
};

const browsersListOutput = `chrome 111
chrome 110
chrome 109
chrome 108
chrome 107
chrome 106
chrome 105
chrome 104
chrome 103
chrome 102
edge 111
edge 110
firefox 111
firefox 110
firefox 109
firefox 108
firefox 107
firefox 106
firefox 105
firefox 104
firefox 103
firefox 102
ios_saf 16.4
ios_saf 16.3
ios_saf 16.2
ios_saf 16.1
ios_saf 16.0
ios_saf 15.6
ios_saf 15.5
ios_saf 15.4
ios_saf 15.2-15.3
ios_saf 15.0-15.1
ios_saf 14.5-14.8
ios_saf 14.0-14.4
op_mob 73
safari 16.4
safari 16.3
safari 16.2
safari 16.1
safari 16.0
safari 15.6
safari 15.5
safari 15.4
safari 15.2-15.3
safari 15.1
safari 15`;

const browsersList = {
  chrome: {
    max: 110,
    min: 102,
  },
  edge: {
    max: 111,
    min: 110,
  },
  firefox: {
    max: 111,
    min: 102,
  },
  ios_saf: {
    max: 16.4,
    min: 15.4,
  },
  op_mob: {
    max: 73,
    min: 73,
  },
  safari: {
    max: 16.4,
    min: 15,
  },
};

// const SUPPORTED_BROWSERS = [
//   'Chrome',
//   'Firefox',
//   'Edge',
//   'Safari',
//   'Mobile Safari',
//   'Opera Mobile',
// ];

// const SUPPORTED_BROWSERS = ['Chrome'];

export default function BrowsersList() {
  const org = useOrganization();
  const api = useApi();
  const location = useLocation();
  const params = useParams();
  const [_, setLoading] = useState(false);

  const {release} = params;

  const eventView = useMemo(() => {
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);

    conditions.addFilterValue('release', release);
    console.log(conditions.formatString());

    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: ['count()'],
        projects: [],
        orderby: '-count',
        query: conditions.formatString(),
      },
      location
    );
  }, [location, release]);

  useEffect(() => {
    api.clear();
    setLoading(true);

    async function fetchEvents() {
      const res = await api.requestPromise(`/organizations/${org.slug}/events/`, {
        query: {
          ...eventView.getEventsAPIPayload(location),
        },
        method: 'GET',
      });
      console.log(res);

      setLoading(false);
    }
    fetchEvents();
  }, [api, org, location, eventView]);

  return (
    <Fragment>
      <div style={{display: 'flex', justifyContent: 'space-evenly'}}>
        <CodeSnippet language="json">
          {JSON.stringify(packageJsonBrowsersList, null, 2)}
        </CodeSnippet>
        <CodeSnippet language="txt">{browsersListOutput}</CodeSnippet>
      </div>

      <div style={{display: 'flex', justifyContent: 'space-evenly'}}>
        <BrowserAnalysis browser="Chrome" />
        <BrowserAnalysis browser="Firefox" />
        <BrowserAnalysis browser="Safari" />
        <BrowserAnalysis browser="Edge" />
      </div>
    </Fragment>
  );
}

interface BrowserAnalysisProps {
  browser: string;
}

function BrowserAnalysis({browser}: BrowserAnalysisProps) {
  const org = useOrganization();
  const api = useApi();
  const location = useLocation();
  const params = useParams();
  const [results, setResults] = useState(undefined);

  const {release} = params;

  const eventView = useMemo(() => {
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);

    conditions.addFilterValue('release', release);
    conditions.addFilterValue('browser.name', browser);
    console.log(conditions.formatString());

    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: ['browser', 'count()'],
        projects: [],
        orderby: '-count',
        query: conditions.formatString(),
      },
      location
    );
  }, [location, release, browser]);

  useEffect(() => {
    api.clear();
    setResults(undefined);
    async function fetchEvents() {
      const res = await api.requestPromise(`/organizations/${org.slug}/events/`, {
        query: {
          ...eventView.getEventsAPIPayload(location),
        },
        method: 'GET',
      });
      setResults(res);
    }
    fetchEvents();
  }, [api, org, location, eventView]);

  if (!results) {
    return <LoadingIndicator />;
  }

  const browserslistInfo = browsersList[browser.toLowerCase()];

  const parsed = parseRes(results);

  return (
    <div>
      {browser}:
      <br />
      Below Min Version {browserslistInfo.min}: {parsed.unsupportedBelow.toFixed(2)}%
      <br />
      Supported: {parsed.supported.toFixed(2)}%
      <br />
      Above Max Version {browserslistInfo.max}: {parsed.unsupportedAbove.toFixed(2)}%
      <br />
      <br />
    </div>
  );
}

function parseRes(res: any) {
  let total = 0;
  let unsupportedBelow = 0;
  let unsupportedAbove = 0;
  let supported = 0;

  res.data.forEach(item => {
    total += item['count()'];
    const [browser, version] = item.browser.split(' ');

    const browserslistInfo = browsersList[browser.toLowerCase()];

    const parts = version.split('.');
    const intVersion = parseFloat(`${parts[0]}.${parts[1]}`);

    console.log(browser, intVersion, browserslistInfo.min, browserslistInfo.max);

    if (intVersion < browserslistInfo.min) {
      unsupportedBelow += item['count()'];
    } else if (intVersion > browserslistInfo.max) {
      unsupportedAbove += item['count()'];
    } else {
      supported += item['count()'];
    }
  });

  return {
    // total,
    unsupportedBelow: (unsupportedBelow / total) * 100,
    unsupportedAbove: (unsupportedAbove / total) * 100,
    supported: (supported / total) * 100,
  };
}

// const _browsersListOutput = ```chrome 111
// chrome 110
// chrome 109
// chrome 108
// chrome 107
// chrome 106
// chrome 105
// chrome 104
// chrome 103
// chrome 102
// edge 111
// edge 110
// firefox 111
// firefox 110
// firefox 109
// firefox 108
// firefox 107
// firefox 106
// firefox 105
// firefox 104
// firefox 103
// firefox 102
// ios_saf 16.4
// ios_saf 16.3
// ios_saf 16.2
// ios_saf 16.1
// ios_saf 16.0
// ios_saf 15.6
// ios_saf 15.5
// ios_saf 15.4
// ios_saf 15.2-15.3
// ios_saf 15.0-15.1
// ios_saf 14.5-14.8
// ios_saf 14.0-14.4
// op_mob 73
// safari 16.4
// safari 16.3
// safari 16.2
// safari 16.1
// safari 16.0
// safari 15.6
// safari 15.5
// safari 15.4
// safari 15.2-15.3
// safari 15.1
// safari 15```;

// const browsersList = {
//   chrome: {
//     min: 102,
//     max: 111,
//   },
//   edge: {
//     min: 110,
//     max: 111,
//   },
//   firefox: {
//     min: 102,
//     max: 111,
//   },
//   ios_saf: {
//     min: 14,
//     max: 16.4,
//   },
//   op_mob: {
//     min: 73,
//     max: 73,
//   },
//   safari: {
//     min: 15,
//     max: 16.4,
//   },
// };

// const RES = {
//   data: [
//     {
//       browser: 'Chrome 115.0.0',
//       'count()': 47468,
//     },
//     {
//       browser: 'Chrome 116.0.0',
//       'count()': 28574,
//     },
//     {
//       browser: 'Chrome 114.0.0',
//       'count()': 6404,
//     },
//     {
//       browser: 'Chrome 88.0.4324',
//       'count()': 1073,
//     },
//     {
//       browser: 'Chrome 113.0.0',
//       'count()': 775,
//     },
//     {
//       browser: 'Chrome 108.0.0',
//       'count()': 653,
//     },
//     {
//       browser: 'Chrome 112.0.0',
//       'count()': 543,
//     },
//     {
//       browser: 'Chrome 112.0.5615',
//       'count()': 388,
//     },
//     {
//       browser: 'Chrome 104.0.0',
//       'count()': 317,
//     },
//     {
//       browser: 'Chrome 107.0.0',
//       'count()': 291,
//     },
//     {
//       browser: 'Chrome 103.0.0',
//       'count()': 239,
//     },
//     {
//       browser: 'Chrome 111.0.0',
//       'count()': 191,
//     },
//     {
//       browser: 'Chrome 79.0.3945',
//       'count()': 168,
//     },
//     {
//       browser: 'Chrome 110.0.0',
//       'count()': 128,
//     },
//     {
//       browser: 'Chrome 105.0.0',
//       'count()': 127,
//     },
//     {
//       browser: 'Chrome 109.0.0',
//       'count()': 112,
//     },
//     {
//       browser: 'Chrome 117.0.0',
//       'count()': 106,
//     },
//     {
//       browser: 'Chrome 80.0.3987',
//       'count()': 82,
//     },
//     {
//       browser: 'Chrome 106.0.5249',
//       'count()': 75,
//     },
//     {
//       browser: 'Chrome 87.0.4280',
//       'count()': 60,
//     },
//     {
//       browser: 'Chrome 106.0.0',
//       'count()': 57,
//     },
//     {
//       browser: 'Chrome 95.0.4638',
//       'count()': 52,
//     },
//     {
//       browser: 'Chrome 118.0.0',
//       'count()': 40,
//     },
//     {
//       browser: 'Chrome 100.0.4896',
//       'count()': 36,
//     },
//     {
//       browser: 'Chrome 101.0.4951',
//       'count()': 35,
//     },
//     {
//       browser: 'Chrome 111.0.5563',
//       'count()': 31,
//     },
//     {
//       browser: 'Chrome 110.0.5481',
//       'count()': 30,
//     },
//     {
//       browser: 'Chrome 102.0.5005',
//       'count()': 27,
//     },
//     {
//       browser: 'Chrome 103.0.5060',
//       'count()': 26,
//     },
//     {
//       browser: 'Chrome 86.0.4240',
//       'count()': 25,
//     },
//     {
//       browser: 'Chrome 102.0.0',
//       'count()': 25,
//     },
//     {
//       browser: 'Chrome 101.0.0',
//       'count()': 23,
//     },
//     {
//       browser: 'Chrome 114.0.5735',
//       'count()': 22,
//     },
//     {
//       browser: 'Chrome 96.0.4664',
//       'count()': 19,
//     },
//     {
//       browser: 'Chrome 92.0.4515',
//       'count()': 15,
//     },
//     {
//       browser: 'Chrome 116.0.5845',
//       'count()': 13,
//     },
//     {
//       browser: 'Chrome 91.0.4472',
//       'count()': 8,
//     },
//     {
//       browser: 'Chrome 108.0.5359',
//       'count()': 7,
//     },
//     {
//       browser: 'Chrome 97.0.4692',
//       'count()': 6,
//     },
//     {
//       browser: 'Chrome 104.0.5112',
//       'count()': 6,
//     },
//     {
//       browser: 'Chrome 99.0.4844',
//       'count()': 6,
//     },
//     {
//       browser: 'Chrome 89.0.4389',
//       'count()': 6,
//     },
//     {
//       browser: 'Chrome 115.0.21929',
//       'count()': 5,
//     },
//     {
//       browser: 'Chrome 115.0.5790',
//       'count()': 5,
//     },
//     {
//       browser: 'Chrome 112.0.24',
//       'count()': 4,
//     },
//     {
//       browser: 'Chrome 90.0.4430',
//       'count()': 4,
//     },
//     {
//       browser: 'Chrome 114.0.24',
//       'count()': 4,
//     },
//     {
//       browser: 'Chrome 113.0.5666',
//       'count()': 4,
//     },
//     {
//       browser: 'Chrome 98.0.4758',
//       'count()': 4,
//     },
//     {
//       browser: 'Chrome 81.0.4044',
//       'count()': 3,
//     },
//   ],
// };
