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

type Props = {
  data: any;
  meta?: Meta;
  inferredContentType?:
    | 'application/json'
    | 'application/x-www-form-urlencoded'
    | 'multipart/form-data';
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
        <AnnotatedText
          value={value}
          chunks={meta.chunks}
          remarks={meta.rem}
          errors={meta.err}
        />
      );
    }

    switch (inferredContentType) {
      case 'application/json':
        return <ContextData data={value} preserveQuotes />;
      case 'application/x-www-form-urlencoded':
      case 'multipart/form-data':
        return (
          <KeyValueList
            data={getTransformedData(value).map(([key, v]) => ({key, value: v, meta}))}
            isContextData
          />
        );
      default:
        return <pre>{JSON.stringify(value, null, 2)}</pre>;
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
