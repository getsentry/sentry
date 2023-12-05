import {useState} from 'react';
import styled from '@emotion/styled';
import isArray from 'lodash/isArray';

import {Button} from 'sentry/components/button';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import ContextLine from 'sentry/components/events/interfaces/frame/contextLine';
import DefaultTitle from 'sentry/components/events/interfaces/frame/defaultTitle';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Frame} from 'sentry/types';
import {hasDDMExperimentalFeature} from 'sentry/utils/metrics/features';
import {useMetricsCodeLocations} from 'sentry/utils/metrics/useMetricsCodeLocations';
import useOrganization from 'sentry/utils/useOrganization';

import Collapsible from '../../components/collapsible';
import {MetricCodeLocationFrame} from '../../utils/metrics/index';

export function CodeLocations({mri}: {mri: string}) {
  const {data} = useMetricsCodeLocations(mri);
  const [isExpandedLocation, setIsExpandedLocation] = useState(null);
  const organization = useOrganization();

  const setExpandLocation = index => {
    if (isExpandedLocation === index) {
      setIsExpandedLocation(null);
    } else {
      setIsExpandedLocation(index);
    }
  };

  if (!hasDDMExperimentalFeature(organization)) {
    return null;
  }

  if (!isArray(data?.codeLocations) || data?.codeLocations.length === 0) {
    return null;
  }

  const codeLocations = data?.codeLocations;
  if (!codeLocations) {
    return null;
  }

  const reversedCodeLocations = codeLocations.toReversed();

  return (
    <Wrapper>
      <Collapsible maxVisibleItems={1}>
        {reversedCodeLocations.map((location, index) => (
          <CodeLocation
            key={`location-${index}`}
            codeLocation={location}
            showContext={isExpandedLocation === index}
            handleShowContext={() => setExpandLocation(index)}
          />
        ))}
      </Collapsible>
    </Wrapper>
  );
}

function CodeLocation({codeLocation, showContext, handleShowContext}) {
  const frameToShow = codeLocation.frames[0];

  if (!frameToShow) {
    return null;
  }

  return (
    <DefaultLineWrapper onClick={handleShowContext}>
      <DefaultLine className="title" showContext={showContext}>
        <DefaultLineTitleWrapper>
          <LeftLineTitle>
            <DefaultTitle
              frame={frameToShow as Frame}
              platform={frameToShow.platform}
              isHoverPreviewed={false}
            />
          </LeftLineTitle>
          <DefaultLineActionButtons>
            <StyledCopyToClipboardButton
              text={`${frameToShow.absPath}:${frameToShow.lineNo}`}
              size="zero"
              iconSize="xs"
            />
            <ToggleContextButton
              title={t('Toggle Context')}
              size="zero"
              onClick={handleShowContext}
            >
              {/* legacy size is deprecated but the icon is too big without it */}
              <IconChevron
                direction={showContext ? 'up' : 'down'}
                size="xs"
                legacySize="8px"
              />
            </ToggleContextButton>
          </DefaultLineActionButtons>
        </DefaultLineTitleWrapper>
      </DefaultLine>
      {showContext && <CodeLocationContext frame={frameToShow} />}
    </DefaultLineWrapper>
  );
}

const ToggleContextButton = styled(Button)`
  background-color: ${p => p.theme.background};
  color: ${p => p.theme.subText};
`;

const DefaultLineActionButtons = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

function CodeLocationContext({frame}: {frame: MetricCodeLocationFrame}) {
  const lineNo = frame.lineNo ?? 0;

  const preContextLines: [number, string][] =
    frame.preContext?.map((line, index) => [lineNo - 5 + index, line]) ?? [];

  const postContextLines: [number, string][] =
    frame.postContext?.map((line, index) => [lineNo + index, line]) ?? [];

  return (
    <ContextWrapper>
      {preContextLines.map(line => (
        <ContextLine key={`pre-${line[1]}`} line={line} isActive={false} />
      ))}
      <ContextLine line={[lineNo, frame.contextLine ?? '']} isActive />
      {postContextLines.map(line => (
        <ContextLine key={`post-${line[1]}`} line={line} isActive={false} />
      ))}
    </ContextWrapper>
  );
}

const Wrapper = styled('div')`
  margin-top: ${space(1)};
  border-radius: ${p => p.theme.borderRadius};

  & > div > div {
    border: 1px solid ${p => p.theme.border};
    border-bottom: 0;
  }

  & > div:last-of-type > div {
    border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
    border-bottom: 1px solid ${p => p.theme.border};
  }

  & > div:first-of-type > div:first-child {
    border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  }

  & code {
    font-family: inherit;
    font-size: inherit;
  }
`;

const ContextWrapper = styled('div')`
  word-wrap: break-word;
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  /* TODO(ddm): find out how it is done on the issues page */
  line-height: 24px;
  min-height: ${space(3)};
  white-space: pre;
  white-space: pre-wrap;
`;

const DefaultLineWrapper = styled('div')`
  :hover {
    cursor: pointer;
  }
`;

const DefaultLine = styled('div')<{showContext?: boolean}>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: ${p => (p.showContext ? `1px solid ${p.theme.border}` : '0')};
`;

const DefaultLineTitleWrapper = styled('div')`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: ${p => p.theme.borderRadius};
  background-color: ${p => p.theme.backgroundTertiary};
  font-size: ${p => p.theme.codeFontSize};
  line-height: ${p => p.theme.fontSizeLarge};
  font-style: normal;

  padding: ${space(0.75)} ${space(2)} ${space(0.75)} ${space(3)};
  word-break: break-all;
  word-break: break-word;
`;

const LeftLineTitle = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledCopyToClipboardButton = styled(CopyToClipboardButton)`
  display: flex;
`;
