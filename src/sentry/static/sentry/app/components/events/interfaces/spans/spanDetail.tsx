import React from 'react';
import styled from 'react-emotion';
import {get, map} from 'lodash';

import DateTime from 'app/components/dateTime';
import Pills from 'app/components/pills';
import Pill from 'app/components/pill';
import space from 'app/styles/space';

import {SpanType} from './types';

type PropTypes = {
  span: Readonly<SpanType>;
};

const SpanDetail = (props: PropTypes) => {
  const {span} = props;

  const startTimestamp: number = span.start_timestamp;
  const endTimestamp: number = span.timestamp;

  const duration = (endTimestamp - startTimestamp) * 1000;
  const durationString = `${duration.toFixed(3)} ms`;

  return (
    <SpanDetailContainer
      data-component="span-detail"
      onClick={event => {
        // prevent toggling the span detail
        event.stopPropagation();
      }}
    >
      <table className="table key-value">
        <tbody>
          <Row title="Span ID">{span.span_id}</Row>
          <Row title="Trace ID">{span.trace_id}</Row>
          <Row title="Parent Span ID">{span.parent_span_id || ''}</Row>
          <Row title="Description">{get(span, 'description', '')}</Row>
          <Row title="Start Date">
            <React.Fragment>
              <DateTime date={startTimestamp * 1000} />
              {` (${startTimestamp})`}
            </React.Fragment>
          </Row>
          <Row title="End Date">
            <React.Fragment>
              <DateTime date={endTimestamp * 1000} />
              {` (${endTimestamp})`}
            </React.Fragment>
          </Row>
          <Row title="Duration">{durationString}</Row>
          <Row title="Operation">{span.op || ''}</Row>
          <Row title="Same Process as Parent">
            {String(!!span.same_process_as_parent)}
          </Row>
          <Tags span={span} />
          {map(get(span, 'data', {}), (value, key) => {
            return (
              <Row title={key} key={key}>
                {JSON.stringify(value, null, 4) || ''}
              </Row>
            );
          })}
          <Row title="Raw">{JSON.stringify(span, null, 4)}</Row>
        </tbody>
      </table>
    </SpanDetailContainer>
  );
};

const SpanDetailContainer = styled('div')`
  border-bottom: 1px solid ${p => p.theme.gray1};
  padding: ${space(2)};
  background-color: #faf9fb;

  cursor: auto;
`;

const Row = ({
  title,
  keep,
  children,
}: {
  title: string;
  keep?: boolean;
  children: JSX.Element | string;
}) => {
  if (!keep && !children) {
    return null;
  }

  return (
    <tr>
      <td className="key">{title}</td>
      <td className="value">
        <pre className="val " style={{backgroundColor: '#F0ECF3'}}>
          <span className="val-string">{children}</span>
        </pre>
      </td>
    </tr>
  );
};

const Tags = ({span}: {span: SpanType}) => {
  const tags: {[tag_name: string]: string} | undefined = get(span, 'tags');

  if (!tags) {
    return null;
  }

  const keys = Object.keys(tags);

  if (keys.length <= 0) {
    return null;
  }

  return (
    <tr>
      <td className="key">Tags</td>
      <td className="value">
        <Pills style={{padding: '8px'}}>
          {keys.map((key, index) => {
            return <Pill key={index} name={key} value={String(tags[key]) || ''} />;
          })}
        </Pills>
      </td>
    </tr>
  );
};

export default SpanDetail;
