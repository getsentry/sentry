import {useState} from 'react';
import styled from '@emotion/styled';
import isArray from 'lodash/isArray';

import {Button} from 'sentry/components/button';
import DefaultTitle from 'sentry/components/events/interfaces/frame/defaultTitle';
import {tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Frame} from 'sentry/types';
import {useMetricsCodeLocations} from 'sentry/utils/metrics/useMetricsCodeLocations';

export function CodeLocations({mri}: {mri: string}) {
  const {data} = useMetricsCodeLocations(mri);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isArray(data?.codeLocations) || data?.codeLocations.length === 0) {
    return null;
  }

  const frameToShow = data?.codeLocations[0].frames[0];
  const otherFrames = data?.codeLocations[0].frames.slice(1) ?? [];

  if (!frameToShow) {
    return null;
  }

  return (
    <Wrapper>
      <DefaultLine className="title">
        <DefaultLineTitleWrapper>
          <LeftLineTitle>
            <DefaultTitle
              frame={frameToShow as Frame}
              platform="other"
              isHoverPreviewed={false}
            />
          </LeftLineTitle>
        </DefaultLineTitleWrapper>
        <ToggleButton size="xs" borderless onClick={() => setIsExpanded(curr => !curr)}>
          {isExpanded
            ? tn('Hide %s more frame', 'Hide %s more frames', otherFrames.length)
            : tn('Show %s more frame', 'Show %s more frames', otherFrames.length)}
        </ToggleButton>
      </DefaultLine>
      {isExpanded &&
        otherFrames.map(frame => (
          <DefaultLine className="title" key={frame.absPath}>
            <DefaultLineTitleWrapper>
              <LeftLineTitle>
                <DefaultTitle
                  frame={frame as Frame}
                  platform="other"
                  isHoverPreviewed={false}
                />
              </LeftLineTitle>
            </DefaultLineTitleWrapper>
          </DefaultLine>
        ))}
    </Wrapper>
  );
}

const ToggleButton = styled(Button)`
  color: ${p => p.theme.subText};
  font-style: italic;
  font-weight: normal;
  padding: ${space(0.25)} ${space(0.5)};

  &:hover {
    color: ${p => p.theme.subText};
  }
`;

const Wrapper = styled('div')`
  margin-top: ${space(1)};
  background-color: ${p => p.theme.backgroundTertiary};
  padding: ${space(0.25)} ${space(0.5)};
  border-radius: ${p => p.theme.borderRadius};
`;

const DefaultLine = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const DefaultLineTitleWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-style: italic;
`;

const LeftLineTitle = styled('div')`
  display: flex;
  align-items: center;
`;
