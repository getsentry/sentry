import {Fragment} from 'react';
import styled from '@emotion/styled';

import ExternalLink from 'app/components/links/externalLink';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {SdkSuggestionType, UpdateSdkSuggestion} from 'app/types';
import {Event} from 'app/types/event';

type Props = {
  sdk: Event['sdk'];
  suggestion: NonNullable<Event['sdkUpdates']>[0];
  shortStyle?: boolean;
  capitalized?: boolean;
};

function getSdkUpdateSuggestion({
  sdk,
  suggestion,
  shortStyle = false,
  capitalized = false,
}: Props) {
  function getUpdateSdkContent(newSdkVersion: UpdateSdkSuggestion['newSdkVersion']) {
    if (capitalized) {
      return sdk
        ? shortStyle
          ? tct('Update to @v[new-sdk-version]', {
              ['new-sdk-version']: newSdkVersion,
            })
          : tct('Update your SDK from @v[sdk-version] to @v[new-sdk-version]', {
              ['sdk-version']: sdk.version,
              ['new-sdk-version']: newSdkVersion,
            })
        : t('Update your SDK version');
    }

    return sdk
      ? shortStyle
        ? tct('update to @v[new-sdk-version]', {
            ['new-sdk-version']: newSdkVersion,
          })
        : tct('update your SDK from @v[sdk-version] to @v[new-sdk-version]', {
            ['sdk-version']: sdk.version,
            ['new-sdk-version']: newSdkVersion,
          })
      : t('update your SDK version');
  }

  function getChangeSdkContent(newSdkName: UpdateSdkSuggestion['sdkName']) {
    if (capitalized) {
      return sdk && !shortStyle
        ? tct('Migrate from [sdk-name] to the [new-sdk-name] SDK', {
            ['sdk-name']: sdk.name,
            ['new-sdk-name']: <code>{newSdkName}</code>,
          })
        : tct('Migrate to the [new-sdk-name] SDK', {
            ['new-sdk-name']: <code>{newSdkName}</code>,
          });
    }

    return sdk && !shortStyle
      ? tct('migrate from [sdk-name] to the [new-sdk-name] SDK', {
          ['sdk-name']: sdk.name,
          ['new-sdk-name']: <code>{newSdkName}</code>,
        })
      : tct('migrate to the [new-sdk-name] SDK', {
          ['new-sdk-name']: <code>{newSdkName}</code>,
        });
  }

  function getTitleData() {
    switch (suggestion.type) {
      case SdkSuggestionType.UPDATE_SDK:
        return {
          href: suggestion?.sdkUrl,
          content: getUpdateSdkContent(suggestion.newSdkVersion),
        };
      case SdkSuggestionType.CHANGE_SDK:
        return {
          href: suggestion?.sdkUrl,
          content: getChangeSdkContent(suggestion.newSdkName),
        };
      case SdkSuggestionType.ENABLE_INTEGRATION:
        return {
          href: suggestion?.integrationUrl,
          content: capitalized
            ? t("Enable the '%s' integration", suggestion.integrationName)
            : t("enable the '%s' integration", suggestion.integrationName),
        };
      default:
        return undefined;
    }
  }

  function getTitle() {
    const titleData = getTitleData();

    if (!titleData) {
      return undefined;
    }

    const {href, content} = titleData;

    if (!href) {
      return content;
    }

    return <ExternalLink href={href}>{content}</ExternalLink>;
  }

  const title = getTitle();

  if (!title) {
    return undefined;
  }

  if (!suggestion.enables.length) {
    return title;
  }

  const alertContent = suggestion.enables
    .map((subSuggestion, index) => {
      const subSuggestionContent = getSdkUpdateSuggestion({
        suggestion: subSuggestion,
        capitalized: true,
        sdk,
      });

      if (!subSuggestionContent) {
        return undefined;
      }

      return <Fragment key={index}>{subSuggestionContent}</Fragment>;
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

export default getSdkUpdateSuggestion;

const AlertUl = styled('ul')`
  margin: ${space(1)} 0;
  padding-left: 0 !important;
`;
