import React from 'react';
import PropTypes from 'prop-types';

import AnnotatedText from 'app/components/events/meta/annotatedText';
import KeyValueList from 'app/components/events/interfaces/keyValueList/keyValueListV2';
import {Meta} from 'app/types';
import ContextData from 'app/components/contextData';
import {defined} from 'app/utils';
import ErrorBoundary from 'app/components/errorBoundary';
import ClippedBox from 'app/components/clippedBox';
import {t} from 'app/locale';

import getTransformedData from './getTransformedData';
import {SubData, InferredContentType} from './types';

type Props = {
  data: SubData;
  inferredContentType: InferredContentType;
  meta?: Meta;
};

const RichHttpContentClippedBoxBodySection = ({
  data: value,
  meta,
  inferredContentType,
}: Props) => {
  const getContent = () => {
    if (!defined(value)) {
      return null;
    }

    if (meta && typeof value === 'string') {
      return (
        // <pre> is wrapping AnnotatedText to avoid breaking certain tooltips (untested, yolo)
        <pre>
          <AnnotatedText
            value={value}
            chunks={meta.chunks}
            remarks={meta.rem}
            errors={meta.err}
            data-test-id="rich-http-content-body-context-data"
          />
        </pre>
      );
    }

    switch (inferredContentType) {
      case 'application/json':
        return (
          <ContextData
            data-test-id="rich-http-content-body-context-data"
            data={value}
            preserveQuotes
          />
        );
      case 'application/x-www-form-urlencoded':
      case 'multipart/form-data':
        return (
          <KeyValueList
            data-test-id="rich-http-content-body-key-value-list"
            data={getTransformedData(value).map(([key, v]) => ({
              key,
              subject: key,
              value: v,
              meta,
            }))}
            isContextData
          />
        );
      default:
        return (
          <pre data-test-id="rich-http-content-body-section-pre">
            {JSON.stringify(value, null, 2)}
          </pre>
        );
    }
  };

  const content = getContent();

  return content ? (
    <ClippedBox title={t('Body')} defaultCollapsed>
      <ErrorBoundary mini>{content}</ErrorBoundary>
    </ClippedBox>
  ) : null;
};

RichHttpContentClippedBoxBodySection.propTypes = {
  meta: PropTypes.object,
};

export default RichHttpContentClippedBoxBodySection;
