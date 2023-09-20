import {ComponentProps} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import TextOverflow from 'sentry/components/textOverflow';
import {IconGithub} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ResolvedStoryModule} from 'sentry/views/stories/types';

interface Props extends ComponentProps<'div'> {
  filename: string;
  resolved: ResolvedStoryModule;
}

export default function StoryFile({filename, resolved, style}: Props) {
  const {default: DefaultExport, ...otherExports} = resolved;
  const otherEntries = Object.entries(otherExports);

  const githubViewUrl = `https://github.com/getsentry/sentry/blob/master/static/${filename}`;
  const githubEditUrl = `https://github.com/getsentry/sentry/edit/master/static/${filename}`;

  return (
    <FlexColumn style={style}>
      <FlexRow style={{justifyContent: 'space-between'}}>
        <FlexRow style={{alignItems: 'center', gap: space(1)}}>
          <Header>
            <TextOverflow>{filename}</TextOverflow>
          </Header>
          <CopyToClipboardButton size="xs" iconSize="xs" text={filename} />
        </FlexRow>
        <FlexRow style={{alignItems: 'center', gap: space(1)}}>
          <LinkButton
            href={githubViewUrl}
            external
            icon={<IconGithub />}
            size="xs"
            aria-label={t('View on GitHub')}
          >
            {t('View')}
          </LinkButton>
          <LinkButton
            href={githubEditUrl}
            external
            icon={<IconGithub />}
            size="xs"
            aria-label={t('Edit on GitHub')}
          >
            {t('Edit')}
          </LinkButton>
        </FlexRow>
      </FlexRow>

      <StoryArea>
        {DefaultExport ? <DefaultExport /> : null}
        {otherEntries.map(([field, Component]) => (
          <Component key={field} />
        ))}
      </StoryArea>
    </FlexColumn>
  );
}

const FlexRow = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: var(--stories-grid-space);
  align-content: flex-start;
`;

const FlexColumn = styled('section')`
  display: flex;
  flex-direction: column;
  gap: var(--stories-grid-space);
  max-height: 100%;
`;

const StoryArea = styled('div')`
  overflow: scroll;
`;

const Header = styled('h2')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 400;
  margin: 0;
`;
