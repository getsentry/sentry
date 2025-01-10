import type {ComponentProps} from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import TextOverflow from 'sentry/components/textOverflow';
import {IconGithub} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import type {StoryDescriptor} from './useStoriesLoader';

interface Props extends ComponentProps<'div'> {
  story: StoryDescriptor;
}

export default function StoryFile({story, ...htmlProps}: Props) {
  const {default: DefaultExport, ...namedExports} = story.exports;

  return (
    <StoryFileLayout {...htmlProps}>
      <FlexRow style={{gap: space(1), justifyContent: 'space-between'}}>
        <FlexRow style={{alignItems: 'center', gap: space(1)}}>
          <H2>
            <TextOverflow>{story.filename}</TextOverflow>
          </H2>
          <CopyToClipboardButton size="xs" iconSize="xs" text={story.filename} />
        </FlexRow>
        <StoryLinksContainer>
          <GithubLinks story={story} />
        </StoryLinksContainer>
      </FlexRow>
      {DefaultExport ? (
        <Story>
          <DefaultExport />
        </Story>
      ) : null}
      {Object.entries(namedExports).map(([name, MaybeComponent]) => {
        if (typeof MaybeComponent === 'function') {
          return (
            <Story key={name}>
              <MaybeComponent />
            </Story>
          );
        }

        throw new Error(
          `Story exported an unsupported key ${name} with value: ${typeof MaybeComponent}`
        );
      })}
    </StoryFileLayout>
  );
}

function GithubLinks(props: {story: StoryDescriptor}) {
  return (
    <Fragment>
      <LinkButton
        href={`https://github.com/getsentry/sentry/blob/master/static/${props.story.filename}`}
        external
        icon={<IconGithub />}
        size="xs"
        aria-label={t('View on GitHub')}
      >
        {t('View')}
      </LinkButton>
      <LinkButton
        href={`https://github.com/getsentry/sentry/edit/master/static/${props.story.filename}`}
        external
        icon={<IconGithub />}
        size="xs"
        aria-label={t('Edit on GitHub')}
      >
        {t('Edit')}
      </LinkButton>
    </Fragment>
  );
}

const FlexRow = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: var(--stories-grid-space);
  align-content: flex-start;
`;

const StoryLinksContainer = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${space(1)};
  align-content: flex-start;
  grid-area: header-links;
`;

const StoryFileLayout = styled('section')``;

const Story = styled('section')`
  padding-top: ${space(2)};
`;

const H2 = styled('h2')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightNormal};
  margin: 0;
`;
