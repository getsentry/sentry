import {Fragment} from 'react';
import {IconArrow} from '@sentry/icons/arrow';
import {AnimatePresence} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import * as Storybook from 'sentry/stories';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';

import {FirstEventFooter} from './firstEventFooter';
import {FOOTER_HEIGHT} from './genericFooter';

export default Storybook.story('Onboarding — First Event Footer', story => {
  story('Waiting for the first error', () => (
    <Fragment>
      <p>
        <Storybook.JSXNode name="FirstEventFooter" /> sits at the bottom of the setup docs
        step of onboarding. It tells the user whether their first error has arrived, and
        offers a sample error until it does.
      </p>
      <p>
        The tracks follow the footer&apos;s own width, not the viewport. Below{' '}
        <code>xl</code> they are <code>auto 1fr auto</code>, so Back and the primary
        button keep their natural width and the status takes what is left. At{' '}
        <code>xl</code> and above they are three equal tracks, which centers the status
        under the page content. Drag the demo&apos;s edge to a phone width to check that
        the status stays visible.
      </p>
      <FooterDemo firstEvent={null} />
    </Fragment>
  ));

  story('On a phone', () => (
    <Fragment>
      <p>
        At 390px, the width of an iPhone 14, the status shares the row with Back and{' '}
        <strong>View Sample Error</strong> instead of being hidden.
      </p>
      <FooterDemo firstEvent={null} width="390px" />
    </Fragment>
  ));

  story('Error received', () => (
    <Fragment>
      <p>
        Once <code>project.firstEvent</code> is set, the indicator turns into a checkmark
        and the primary button links to the new issue.
      </p>
      <FooterDemo firstEvent="2026-01-01T00:00:00Z" />
    </Fragment>
  ));
});

interface FooterDemoProps {
  firstEvent: Project['firstEvent'];
  /**
   * Fixes the footer width. Without it the demo is resizable.
   */
  width?: `${number}px`;
}

function FooterDemo({firstEvent, width}: FooterDemoProps) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const firstProject = projects[0];

  if (!firstProject) {
    return <p>This story needs an organization with at least one project.</p>;
  }

  return (
    <Storybook.Demo
      resizable={!width}
      standalone={!!width}
      direction="column"
      align={width ? 'center' : 'stretch'}
      padding={width ? 'xl' : '0'}
    >
      {/* The footer is position: fixed. A transformed ancestor becomes its
          containing block, so it pins to the bottom of the demo, not the page. */}
      <Container
        width={width ?? '100%'}
        height={FOOTER_HEIGHT}
        style={{transform: 'translateZ(0)'}}
      >
        <AnimatePresence initial={false}>
          <FirstEventFooter
            organization={organization}
            project={{...firstProject, firstEvent}}
            isLast
            onClickSetupLater={() => {}}
            leading={
              <Button icon={<IconArrow direction="left" />} variant="transparent">
                {t('Back')}
              </Button>
            }
          />
        </AnimatePresence>
      </Container>
    </Storybook.Demo>
  );
}
