import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import EmptyMessage from 'sentry/components/emptyMessage';
import ContextLine from 'sentry/components/events/interfaces/frame/contextLine';
import DefaultTitle from 'sentry/components/events/interfaces/frame/defaultTitle';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {SelectionRange} from 'sentry/components/metrics/chart/types';
import {IconChevron, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Frame} from 'sentry/types/event';
import type {MRI} from 'sentry/types/metrics';
import type {MetricCodeLocationFrame} from 'sentry/utils/metrics/types';
import {useMetricCodeLocations} from 'sentry/utils/metrics/useMetricsCodeLocations';

interface CodeLocationsProps extends SelectionRange {
  mri?: MRI;
}

export function CodeLocations({mri, ...rangeOpts}: CodeLocationsProps) {
  const {data, isFetching, isError, refetch} = useMetricCodeLocations(mri, rangeOpts);

  if (isFetching) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  if (!mri) {
    return (
      <CenterContent>
        <EmptyMessage
          style={{margin: 'auto'}}
          icon={<IconSearch size="xxl" />}
          title={t('Nothing to show!')}
          description={t('Choose a metric to display data.')}
        />
      </CenterContent>
    );
  }

  if (!Array.isArray(data) || data.length === 0) {
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

  const codeLocations = data[0]!.frames ?? [];

  // We only want to show the first 5 code locations
  const codeLocationsToShow = codeLocations.slice(0, 5);
  return (
    <CodeLocationsWrapper>
      {codeLocationsToShow.slice(0, 5).map((location, index) => (
        <CodeLocation
          key={`location-${index}`}
          codeLocation={location}
          isFirst={index === 0}
          isLast={index === codeLocationsToShow.length - 1}
        />
      ))}
    </CodeLocationsWrapper>
  );
}

type CodeLocationProps = {
  codeLocation: MetricCodeLocationFrame;
  isFirst?: boolean;
  isLast?: boolean;
};

function CodeLocation({codeLocation, isFirst, isLast}: CodeLocationProps) {
  const [showContext, setShowContext] = useState(!!isFirst);

  const toggleShowContext = useCallback(() => {
    setShowContext(prevState => !prevState);
  }, []);

  const hasContext = !!codeLocation.contextLine;

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
                frame={codeLocation as Frame}
                isHoverPreviewed={false}
                platform="other"
              />
            </LeftLineTitle>
            <DefaultLineActionButtons>
              <CopyToClipboardButton
                text={`${codeLocation.filename}:${codeLocation.lineNo}`}
                size="zero"
                iconSize="xs"
                borderless
                onClick={e => {
                  e.stopPropagation();
                }}
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
          <CodeLocationContext codeLocation={codeLocation} isLast={isLast} />
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
  codeLocation: MetricCodeLocationFrame;
  isLast?: boolean;
};

function CodeLocationContext({codeLocation, isLast}: CodeLocationContextProps) {
  const lineNo = codeLocation.lineNo ?? 0;

  const preContextLines: [number, string][] = useMemo(
    () => codeLocation.preContext?.map((line, index) => [lineNo - 5 + index, line]) ?? [],
    [codeLocation.preContext, lineNo]
  );

  const postContextLines: [number, string][] = useMemo(
    () => codeLocation.postContext?.map((line, index) => [lineNo + index, line]) ?? [],
    [codeLocation.postContext, lineNo]
  );

  return (
    <SourceContextWrapper isLast={isLast}>
      {preContextLines.map(line => (
        <ContextLine key={`pre-${line[0]}-${line[1]}`} line={line} isActive={false} />
      ))}
      <ContextLine line={[lineNo, codeLocation.contextLine ?? '']} isActive />
      {postContextLines.map(line => (
        <ContextLine key={`post-${line[0]}-${line[1]}`} line={line} isActive={false} />
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
