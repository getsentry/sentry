import {useCallback, useState} from 'react';
import styled from '@emotion/styled';
import isArray from 'lodash/isArray';
import {PlatformIcon} from 'platformicons';

import {Button} from 'sentry/components/button';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import ContextLine from 'sentry/components/events/interfaces/frame/contextLine';
import DefaultTitle from 'sentry/components/events/interfaces/frame/defaultTitle';
import {stackTracePlatformIcon} from 'sentry/components/events/interfaces/utils';
import {IconChevron} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Frame} from 'sentry/types';
import {hasDDMExperimentalFeature} from 'sentry/utils/metrics/features';
import {useMetricsCodeLocations} from 'sentry/utils/metrics/useMetricsCodeLocations';
import useOrganization from 'sentry/utils/useOrganization';

import Collapsible from '../../components/collapsible';
import {MetricCodeLocationFrame} from '../../utils/metrics/index';

export function CodeLocations({mri}: {mri: string}) {
  const {data} = useMetricsCodeLocations(mri);
  // Keeps track of which code location has expanded source context
  const [expanedCodeLocation, setExpandedCodeLocation] = useState(null);
  // Keeps track of whether the code locations are collapsed or not
  const [collapsed, setCollapsed] = useState(true);
  const organization = useOrganization();

  const toggleExpandedLocation = useCallback(
    index => {
      if (expanedCodeLocation === index) {
        setExpandedCodeLocation(null);
      } else {
        setExpandedCodeLocation(index);
      }
    },
    [expanedCodeLocation]
  );

  if (!hasDDMExperimentalFeature(organization)) {
    return null;
  }
  const codeLocations = data?.codeLocations;

  if (!codeLocations || !isArray(codeLocations) || codeLocations.length === 0) {
    return null;
  }

  // We only want to show the first 5 code locations
  const reversedCodeLocations = codeLocations.slice(0, 5);

  return (
    <Wrapper>
      <Collapsible
        maxVisibleItems={1}
        expandButton={({onExpand, numberOfHiddenItems}) => (
          <CollapsibleButton
            priority="link"
            onClick={() => {
              setCollapsed(false);
              onExpand();
            }}
          >
            {tn(
              'Show %s more code location',
              'Show %s more code locations',
              numberOfHiddenItems
            )}
          </CollapsibleButton>
        )}
        collapseButton={({onCollapse}) => (
          <CollapsibleButton
            priority="link"
            onClick={() => {
              setCollapsed(true);
              onCollapse();
            }}
          >
            {t('Collapse')}
          </CollapsibleButton>
        )}
      >
        {reversedCodeLocations.map((location, index) => (
          <CodeLocation
            key={`location-${index}`}
            codeLocation={location}
            showContext={expanedCodeLocation === index}
            handleShowContext={() => toggleExpandedLocation(index)}
            isFirst={index === 0}
            isLast={collapsed || index === reversedCodeLocations.length - 1}
          />
        ))}
      </Collapsible>
    </Wrapper>
  );
}

function CodeLocation({codeLocation, showContext, handleShowContext, isFirst, isLast}) {
  const frameToShow = codeLocation.frames[0];

  if (!frameToShow) {
    return null;
  }

  const platformIcon = stackTracePlatformIcon(frameToShow.platform, codeLocation.frames);

  const hasContext = !!frameToShow.contextLine;

  return (
    <CodeLocationWrapper>
      <PlatformIcon size="20px" radius={null} platform={platformIcon} />
      <DefaultLineWrapper
        onClick={() => {
          if (!hasContext) {
            return;
          }
          handleShowContext();
        }}
        isFirst={isFirst}
        isLast={isLast}
      >
        <DefaultLine className="title" isFirst={isFirst}>
          <DefaultLineTitleWrapper>
            <LeftLineTitle>
              <DefaultTitle
                frame={frameToShow as Frame}
                platform={frameToShow.platform}
                isHoverPreviewed={false}
              />
            </LeftLineTitle>
            <DefaultLineActionButtons>
              <CopyToClipboardButton
                text={`${frameToShow.filename}:${frameToShow.lineNo}`}
                size="zero"
                iconSize="xs"
                borderless
              />

              <ToggleContextButton
                title={hasContext ? t('Toggle Context') : undefined}
                size="zero"
                onClick={handleShowContext}
                disabled={!hasContext}
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
        {showContext && hasContext && (
          <CodeLocationContext frame={frameToShow} isLast={isLast} />
        )}
      </DefaultLineWrapper>
    </CodeLocationWrapper>
  );
}

function CodeLocationContext({
  frame,
  isLast,
}: {
  frame: MetricCodeLocationFrame;
  isLast: boolean;
}) {
  const lineNo = frame.lineNo ?? 0;

  const preContextLines: [number, string][] =
    frame.preContext?.map((line, index) => [lineNo - 5 + index, line]) ?? [];

  const postContextLines: [number, string][] =
    frame.postContext?.map((line, index) => [lineNo + index, line]) ?? [];

  return (
    <ContextWrapper isLast={isLast}>
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

const CodeLocationWrapper = styled('div')`
  display: flex;
`;

const ToggleContextButton = styled(Button)`
  background-color: ${p => p.theme.background};
  color: ${p => p.theme.subText};
`;

const DefaultLineActionButtons = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const Wrapper = styled('div')`
  margin-top: ${space(1)};

  & code {
    font-family: inherit;
    font-size: inherit;
  }
`;

const ContextWrapper = styled('div')<{isLast?: boolean}>`
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

const DefaultLineWrapper = styled('div')<{isFirst?: boolean; isLast?: boolean}>`
  :hover {
    cursor: pointer;
  }
  flex-grow: 1;

  border-top-left-radius: 0;
  border-top-right-radius: ${p => (p.isFirst ? p.theme.borderRadius : 0)};
  border-bottom-left-radius: ${p => (p.isLast ? p.theme.borderRadius : 0)};
  border-bottom-right-radius: ${p => (p.isLast ? p.theme.borderRadius : 0)};

  border: 1px solid ${p => p.theme.border};
  border-top: ${p => (p.isFirst ? `1px solid ${p.theme.border}` : 'none')};

  background-color: ${p => p.theme.backgroundTertiary};
`;

const DefaultLine = styled('div')<{isFirst?: boolean}>`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const DefaultLineTitleWrapper = styled('div')`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;

  font-size: ${p => p.theme.codeFontSize};
  line-height: ${p => p.theme.fontSizeLarge};
  font-style: normal;

  padding: ${space(0.75)} ${space(2)} ${space(0.75)} ${space(1.5)};
  word-break: break-all;
  word-break: break-word;
`;

const LeftLineTitle = styled('div')`
  display: flex;
  align-items: center;
`;

// done to align the collapsible button with the text in default line title
const CollapsibleButton = styled(Button)`
  margin-left: 36px;
`;
