import React from 'react';
import styled from 'react-emotion';
import _ from 'lodash';

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

  const start_timestamp: number = span.start_timestamp;
  const end_timestamp: number = span.timestamp;

  const duration = (end_timestamp - start_timestamp) * 1000;
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
          <Row title="Description">{_.get(span, 'description', '')}</Row>
          <Row title="Start Date">
            <React.Fragment>
              <DateTime date={start_timestamp * 1000} />
              {` (${start_timestamp})`}
            </React.Fragment>
          </Row>
          <Row title="End Date">
            <React.Fragment>
              <DateTime date={end_timestamp * 1000} />
              {` (${end_timestamp})`}
            </React.Fragment>
          </Row>
          <Row title="Duration">{durationString}</Row>
          <Row title="Operation">{span.op || ''}</Row>
          <Row title="Same Process as Parent">
            {String(!!span.same_process_as_parent)}
          </Row>
          <Tags span={span} />
          {_.map(_.get(span, 'data', {}), (value, key) => {
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
  border-bottom: 1px solid #d1cad8;
  padding: ${space(2)};
  background-color: #fff;

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
        <pre className="val ">
          <span className="val-string">{children}</span>
        </pre>
      </td>
    </tr>
  );
};

const Tags = ({span}: {span: SpanType}) => {
  const tags: {[tag_name: string]: string} | undefined = _.get(span, 'tags');

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
