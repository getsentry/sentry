import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text/heading';
import {Text} from 'sentry/components/core/text/text';
import {IconGithub} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import type {PRData, PRDetails} from './types';

interface PRHeaderProps {
  breadcrumbItems: any[] | null;
  isInPreventContext: boolean;
  prData: PRData | null;
  prDetails: PRDetails | null;
  prId: string;
  repoName: string;
}

function PRHeader({
  prData,
  prDetails,
  repoName,
  prId,
  isInPreventContext,
  breadcrumbItems,
}: PRHeaderProps) {
  const [expandedDescription, setExpandedDescription] = useState(false);
  const [needsExpansion, setNeedsExpansion] = useState(false);
  const descriptionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (descriptionRef.current && prDetails?.body) {
      // Check if content overflows the max-height
      const element = descriptionRef.current;
      const isOverflowing = element.scrollHeight > element.clientHeight;
      setNeedsExpansion(isOverflowing);
    }
  }, [prDetails?.body]);

  return (
    <Header>
      {isInPreventContext && breadcrumbItems && (
        <BreadcrumbContainer>
          <Breadcrumbs crumbs={breadcrumbItems} />
        </BreadcrumbContainer>
      )}
      {prDetails ? (
        <PRTitleSection>
          <TitleRow>
            <PRTitleHeading as="h1" size="xl">
              {prDetails.title}
            </PRTitleHeading>
            <Button
              size="sm"
              icon={<IconGithub />}
              onClick={() => window.open(prDetails.html_url, '_blank')}
            >
              {t('View on GitHub')}
            </Button>
          </TitleRow>
          <MetadataFlex gap="md">
            <Text variant="muted" size="sm">
              <Text as="span" bold>
                {t('Repository:')}
              </Text>{' '}
              {decodeURIComponent(repoName)}
            </Text>
          </MetadataFlex>
          <PRDetailsCard>
            <PRMeta>
              <PRAuthor>
                <AuthorAvatar
                  src={prDetails.user.avatar_url}
                  alt={prDetails.user.login}
                />
                <AuthorInfo>
                  <AuthorName
                    href={prDetails.user.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {prDetails.user.login}
                  </AuthorName>
                  <Text variant="muted" size="xs">
                    {t('opened')} {new Date(prDetails.created_at).toLocaleDateString()}
                  </Text>
                </AuthorInfo>
              </PRAuthor>
              <PRBadges>
                <PRStateBadge state={prDetails.merged_at ? 'merged' : prDetails.state}>
                  {prDetails.merged_at ? 'merged' : prDetails.state}
                </PRStateBadge>
                <Text variant="muted" size="xs" monospace>
                  #{prId}
                </Text>
              </PRBadges>
            </PRMeta>
            {prDetails.body && (
              <PRDescriptionWrapper>
                <PRDescription
                  ref={descriptionRef}
                  isExpanded={expandedDescription}
                  needsGradient={needsExpansion}
                  dangerouslySetInnerHTML={{
                    __html: prDetails.body.replace(/\n/g, '<br>'),
                  }}
                />
                {!expandedDescription && needsExpansion && (
                  <ExpandButton onClick={() => setExpandedDescription(true)}>
                    {t('See more')}
                  </ExpandButton>
                )}
                {expandedDescription && (
                  <ExpandButton onClick={() => setExpandedDescription(false)}>
                    {t('See less')}
                  </ExpandButton>
                )}
              </PRDescriptionWrapper>
            )}
          </PRDetailsCard>
        </PRTitleSection>
      ) : (
        <FallbackHeader>
          <Heading as="h1">{t('Pull Request Details')}</Heading>
          <MetadataFlex gap="md">
            <Text variant="muted" size="sm">
              <Text as="span" bold>
                {t('Repository:')}
              </Text>{' '}
              {decodeURIComponent(repoName)}
            </Text>
            <Text variant="muted" size="sm">
              <Text as="span" bold>
                {t('Files Changed:')}
              </Text>{' '}
              {prData?.pr_files?.length || prData?.files?.length || 0}
            </Text>
          </MetadataFlex>
        </FallbackHeader>
      )}
    </Header>
  );
}

const Header = styled('div')`
  margin-bottom: ${space(3)};
`;

const BreadcrumbContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

const PRTitleSection = styled('div')`
  margin-bottom: ${space(2)};
`;

const TitleRow = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: ${space(1)};
`;

const PRTitleHeading = styled(Heading)`
  flex: 1;
  margin-right: ${space(2)};
`;

const PRDetailsCard = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: 6px;
  padding: ${space(1.5)};
  margin-top: ${space(1)};
`;

const PRMeta = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${space(1)};
`;

const PRAuthor = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const AuthorAvatar = styled('img')`
  width: 24px;
  height: 24px;
  border-radius: 50%;
`;

const AuthorInfo = styled('div')`
  display: flex;
  flex-direction: column;
`;

const AuthorName = styled('a')`
  font-weight: 600;
  color: ${p => p.theme.headingColor};
  text-decoration: none;
  font-size: ${p => p.theme.fontSize.sm};

  &:hover {
    color: ${p => p.theme.purple300};
    text-decoration: underline;
  }
`;

const PRBadges = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const PRStateBadge = styled('span')<{state: 'open' | 'closed' | 'merged'}>`
  padding: ${space(0.25)} ${space(0.75)};
  border-radius: 12px;
  font-size: ${p => p.theme.fontSize.xs};
  font-weight: 600;
  text-transform: capitalize;

  ${p => {
    switch (p.state) {
      case 'open':
        return `
          background-color: ${p.theme.green100};
          color: ${p.theme.green400};
        `;
      case 'closed':
        return `
          background-color: ${p.theme.red100};
          color: ${p.theme.red400};
        `;
      case 'merged':
        return `
          background-color: ${p.theme.purple100};
          color: ${p.theme.purple400};
        `;
      default:
        return `
          background-color: ${p.theme.gray100};
          color: ${p.theme.gray400};
        `;
    }
  }}
`;

const PRDescriptionWrapper = styled('div')`
  border-top: 1px solid ${p => p.theme.border};
  padding-top: ${space(1)};
  margin-top: ${space(1)};
`;

const PRDescription = styled('div')<{isExpanded: boolean; needsGradient: boolean}>`
  color: ${p => p.theme.gray400};
  line-height: 1.5;
  font-size: ${p => p.theme.fontSize.sm};
  ${p =>
    !p.isExpanded &&
    p.needsGradient &&
    `
    max-height: 100px;
    overflow: hidden;
    position: relative;

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      height: 20px;
      width: 100%;
      background: linear-gradient(transparent, ${p.theme.background});
    }
  `}

  br {
    line-height: 1.5;
  }

  p {
    margin: ${space(1)} 0;
    &:first-child {
      margin-top: 0;
    }
    &:last-child {
      margin-bottom: 0;
    }
  }
`;

const ExpandButton = styled('button')`
  background: none;
  border: none;
  color: ${p => p.theme.purple300};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 600;
  cursor: pointer;
  padding: ${space(0.75)} 0;
  margin-top: ${space(0.75)};
  display: block;
  position: relative;
  z-index: 1;

  &:hover {
    color: ${p => p.theme.purple400};
    text-decoration: underline;
  }
`;

const FallbackHeader = styled('div')`
  margin-bottom: ${space(1)};
`;

const MetadataFlex = styled(Flex)`
  margin-top: ${space(1)};
`;

export default PRHeader;
