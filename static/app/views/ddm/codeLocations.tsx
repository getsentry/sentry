import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import EmptyMessage from 'sentry/components/emptyMessage';
import ContextLine from 'sentry/components/events/interfaces/frame/contextLine';
import DefaultTitle from 'sentry/components/events/interfaces/frame/defaultTitle';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconChevron, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Frame} from 'sentry/types';
import {hasDDMExperimentalFeature} from 'sentry/utils/metrics/features';
import {useMetricsCodeLocations} from 'sentry/utils/metrics/useMetricsCodeLocations';
import useOrganization from 'sentry/utils/useOrganization';

import {MetricCodeLocationFrame, MetricMetaCodeLocation} from '../../utils/metrics/index';

export function CodeLocations({mri}: {mri: string}) {
  const {data, isLoading, isError, refetch} = useMetricsCodeLocations(mri);
  const organization = useOrganization();

  if (!hasDDMExperimentalFeature(organization)) {
    return null;
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  if (!Array.isArray(data?.codeLocations) || data?.codeLocations.length === 0) {
    return (
      <CenterContent>
        <EmptyMessage
          style={{margin: 'auto'}}
          icon={<IconSearch size="xxl" />}
          title={t('Nothing to show!')}
          description={t('No code locations found for this metric.')}
        />
      </CenterContent>
    );
  }

  const codeLocations = data?.codeLocations ?? [];

  // We only want to show the first 5 code locations
  const reversedCodeLocations = codeLocations.slice(0, 5);
  return (
    <CodeLocationsWrapper>
      {reversedCodeLocations.map((location, index) => (
        <CodeLocation
          key={`location-${index}`}
          codeLocation={location}
          isFirst={index === 0}
          isLast={index === reversedCodeLocations.length - 1}
        />
      ))}
    </CodeLocationsWrapper>
  );
}

type CodeLocationProps = {
  codeLocation: MetricMetaCodeLocation;
  isFirst?: boolean;
  isLast?: boolean;
};

function CodeLocation({codeLocation, isFirst, isLast}: CodeLocationProps) {
  const [showContext, setShowContext] = useState(!!isFirst);

  const toggleShowContext = useCallback(() => {
    setShowContext(prevState => !prevState);
  }, []);

  const frameToShow = codeLocation.frames[0];
  if (!frameToShow) {
    return null;
  }

  const hasContext = !!frameToShow.contextLine;

  return (
    <CodeLocationWrapper>
      <DefaultLineWrapper
        onClick={() => {
          if (!hasContext) {
            return;
          }
          toggleShowContext();
        }}
        isFirst={isFirst}
        isLast={isLast}
        hasContext={hasContext}
      >
        <DefaultLine className="title" showContext={showContext}>
          <DefaultLineTitleWrapper>
            <LeftLineTitle>
              <DefaultTitle
                frame={frameToShow as Frame}
                isHoverPreviewed={false}
                platform="other"
              />
            </LeftLineTitle>
            <DefaultLineActionButtons>
              <CopyToClipboardButton
                text={`${frameToShow.filename}:${frameToShow.lineNo}`}
                size="zero"
                iconSize="xs"
                borderless
              />
              <ToggleCodeLocationContextButton
                disabled={!hasContext}
                isToggled={showContext}
                handleToggle={toggleShowContext}
              />
            </DefaultLineActionButtons>
          </DefaultLineTitleWrapper>
        </DefaultLine>
        {showContext && hasContext && (
          <CodeLocationContext frame={frameToShow} isLast={isLast} />
        )}
      </DefaultLineWrapper>
    </CodeLocationWrapper>
  );
}

type ToggleCodeLocationContextButtonProps = {
  disabled: boolean;
  handleToggle: () => void;
  isToggled: boolean;
};

function ToggleCodeLocationContextButton({
  disabled,
  isToggled,
  handleToggle,
}: ToggleCodeLocationContextButtonProps) {
  return (
    <Button
      title={disabled ? t('No context available') : t('Toggle Context')}
      size="zero"
      onClick={event => {
        event.stopPropagation();
        handleToggle();
      }}
      disabled={disabled}
    >
      {/* legacy size is deprecated but the icon is too big without it */}
      <IconChevron direction={isToggled ? 'up' : 'down'} size="xs" legacySize="8px" />
    </Button>
  );
}

type CodeLocationContextProps = {
  frame: MetricCodeLocationFrame;
  isLast?: boolean;
};

function CodeLocationContext({frame, isLast}: CodeLocationContextProps) {
  const lineNo = frame.lineNo ?? 0;

  const preContextLines: [number, string][] = useMemo(
    () => frame.preContext?.map((line, index) => [lineNo - 5 + index, line]) ?? [],
    [frame.preContext, lineNo]
  );

  const postContextLines: [number, string][] = useMemo(
    () => frame.postContext?.map((line, index) => [lineNo + index, line]) ?? [],
    [frame.postContext, lineNo]
  );

  return (
    <SourceContextWrapper isLast={isLast}>
      {preContextLines.map(line => (
        <ContextLine key={`pre-${line[1]}`} line={line} isActive={false} />
      ))}
      <ContextLine line={[lineNo, frame.contextLine ?? '']} isActive />
      {postContextLines.map(line => (
        <ContextLine key={`post-${line[1]}`} line={line} isActive={false} />
      ))}
    </SourceContextWrapper>
  );
}

const CodeLocationWrapper = styled('div')`
  display: flex;
`;

const DefaultLineActionButtons = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const CodeLocationsWrapper = styled('div')`
  & code {
    font-family: inherit;
    font-size: inherit;
  }
`;

const SourceContextWrapper = styled('div')<{isLast?: boolean}>`
  word-wrap: break-word;
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  /* TODO(ddm): find out how it is done on the issues page */
  line-height: 24px;
  min-height: ${space(3)};
  white-space: pre;
  white-space: pre-wrap;

  background-color: ${p => p.theme.background};
`;

const DefaultLineWrapper = styled('div')<{
  hasContext?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}>`
  :hover {
    cursor: ${p => p.hasContext && 'pointer'};
  }
  flex-grow: 1;

  border-top-left-radius: ${p => (p.isFirst ? p.theme.borderRadius : 0)};
  border-top-right-radius: ${p => (p.isFirst ? p.theme.borderRadius : 0)};
  border-bottom-left-radius: ${p => (p.isLast ? p.theme.borderRadius : 0)};
  border-bottom-right-radius: ${p => (p.isLast ? p.theme.borderRadius : 0)};

  border: 1px solid ${p => p.theme.border};
  border-top: ${p => (p.isFirst ? `1px solid ${p.theme.border}` : 'none')};

  background-color: ${p => p.theme.backgroundTertiary};
`;

const DefaultLine = styled('div')<{showContext?: boolean}>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: ${p => (p.showContext ? `1px solid ${p.theme.border}` : 'none')};
`;

const DefaultLineTitleWrapper = styled('div')`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;

  font-size: ${p => p.theme.codeFontSize};
  line-height: ${p => p.theme.fontSizeLarge};
  font-style: normal;

  padding: ${space(0.75)} ${space(3)} ${space(0.75)} ${space(1.5)};
  word-break: break-all;
  word-break: break-word;
`;

const LeftLineTitle = styled('div')`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
`;

const CenterContent = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
`;
