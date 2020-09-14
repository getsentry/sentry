import React from 'react';
import styled from '@emotion/styled';

import {t, tct} from 'app/locale';
import {Event} from 'app/types';
import space from 'app/styles/space';
import ExternalLink from 'app/components/links/externalLink';

type Props = {
  event: Event;
  suggestion: NonNullable<Event['sdkUpdates']>[0];
};

function getSuggestion({event, suggestion}: Props) {
  const getTitleData = () => {
    switch (suggestion.type) {
      case 'updateSdk':
        return {
          href: suggestion?.sdkUrl,
          content: event?.sdk
            ? t(
                'update your SDK from version %s to version %s',
                event.sdk.version,
                suggestion.newSdkVersion
              )
            : t('update your SDK version'),
        };
      case 'changeSdk':
        return {
          href: suggestion?.sdkUrl,
          content: tct('migrate to the [sdkName] SDK', {
            sdkName: <code>{suggestion.newSdkName}</code>,
          }),
        };
      case 'enableIntegration':
        return {
          href: suggestion?.integrationUrl,
          content: t("enable the '%s' integration", suggestion.integrationName),
        };
      default:
        return null;
    }
  };

  const getTitle = () => {
    const titleData = getTitleData();

    if (!titleData) {
      return null;
    }

    const {href, content} = titleData;

    if (!href) {
      return content;
    }

    return <ExternalLink href={href}>{content}</ExternalLink>;
  };

  const title = getTitle();

  if (!suggestion.enables.length) {
    return title;
  }

  const alertContent = suggestion.enables
    .map((subSuggestion, index) => {
      const subSuggestionContent = getSuggestion({suggestion: subSuggestion, event});
      if (!subSuggestionContent) {
        return null;
      }
      return <React.Fragment key={index}>{subSuggestionContent}</React.Fragment>;
    })
    .filter(content => !!content);

  if (!alertContent.length) {
    return title;
  }

  return tct('[title] so you can: [suggestion]', {
    title,
    suggestion: <AlertUl>{alertContent}</AlertUl>,
  });
}

export default getSuggestion;

const AlertUl = styled('ul')`
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};
  padding-left: 0 !important;
`;
