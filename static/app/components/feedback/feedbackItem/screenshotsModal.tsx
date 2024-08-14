import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import ScreenshotPagination from 'sentry/components/events/eventTagsAndScreenshot/screenshot/screenshotPagination';
import FeedbackScreenshot from 'sentry/components/feedback/feedbackItem/feedbackScreenshot';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {tct} from 'sentry/locale';
import type {EventAttachment} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

type Props = ModalRenderProps & {
  initialIndex: number;
  organization: Organization;
  projectSlug: Project['slug'];
  screenshots: EventAttachment[];
};

export default function ScreenshotsModal({
  Body,
  Header,
  initialIndex,
  organization,
  projectSlug,
  screenshots,
}: Props) {
  // Selected index can be any integer, positive or negative
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  // Current index maps the selectedIndex into the range for which we have screenshots
  const currentIndex = selectedIndex % screenshots.length;
  // Cannot be undefined because of the modulo above:
  const currentScreenshot = screenshots.at(currentIndex)!;

  return (
    <Fragment>
      <Header closeButton>
        {screenshots.length > 1 && (
          <PaginationWrapper lightText>
            <StyledScreenshotPagination
              nextDisabled={false}
              previousDisabled={false}
              onNext={() => {
                setSelectedIndex(prev => prev + 1);
              }}
              onPrevious={() => {
                setSelectedIndex(prev => prev - 1);
              }}
              headerText={tct('[currentScreenshotIndex] of [totalScreenshotCount]', {
                currentScreenshotIndex: currentIndex + 1,
                totalScreenshotCount: screenshots.length,
              })}
            />
          </PaginationWrapper>
        )}
      </Header>
      <Body style={{display: 'flex', justifyContent: 'center'}}>
        <FeedbackScreenshot
          organization={organization}
          screenshot={currentScreenshot}
          projectSlug={projectSlug}
        />
      </Body>
    </Fragment>
  );
}

const PaginationWrapper = styled(PanelHeader)`
  margin: 0;
  padding: 0;
  border: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-transform: none;
  background: ${p => p.theme.background};
`;

const StyledScreenshotPagination = styled(ScreenshotPagination)`
  flex-grow: 1;
`;

export const modalCss = css`
  height: 100%;
  width: 100%;
  margin-top: 0 !important;
`;
