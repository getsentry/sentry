import {useState} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';
import type {LocationDescriptor} from 'history';

import {Flex} from '@sentry/scraps/layout';

import type {TagSegment} from 'sentry/actionCreators/events';
import {Button} from 'sentry/components/core/button';
import {Link} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {percent} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isMobilePlatform} from 'sentry/utils/platform';
import {appendExcludeTagValuesCondition} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

const MAX_SEGMENTS = 4;
const TOOLTIP_DELAY = 800;

type Props = {
  segments: TagSegment[];
  title: string;
  totalValues: number;
  colors?: string[];
  expandByDefault?: boolean;
  onTagClick?: (title: string, value: TagSegment) => void;
  onTagValueClick?: (title: string, value: TagSegment) => void;
  otherUrl?: LocationDescriptor;
  project?: Project;
};

function TagFacetsDistributionMeter({
  segments,
  title,
  totalValues,
  onTagClick,
  onTagValueClick,
  project,
  expandByDefault,
  otherUrl,
}: Props) {
  const theme = useTheme();
  const colors = theme.chart.getColorPalette(4);
  const location = useLocation();
  const organization = useOrganization();
  const [expanded, setExpanded] = useState<boolean>(!!expandByDefault);
  const [hoveredValue, setHoveredValue] = useState<TagSegment | null>(null);
  const topSegments = segments.slice(0, MAX_SEGMENTS);

  function renderTitle() {
    if (!Array.isArray(segments) || segments.length <= 0) {
      return (
        <Title>
          <TitleType>{title}</TitleType>
        </Title>
      );
    }

    return (
      <Title>
        <TitleType>{title}</TitleType>
        <Tooltip
          skipWrapper
          delay={TOOLTIP_DELAY}
          title={topSegments[0]!.name || t('n/a')}
        >
          <TitleDescription>{topSegments[0]!.name || t('n/a')}</TitleDescription>
        </Tooltip>
        <ExpandToggleButton
          borderless
          size="zero"
          icon={<IconChevron direction={expanded ? 'up' : 'down'} size="xs" />}
          aria-label={t(
            '%s %s tag distribution',
            expanded ? 'Collapse' : 'Expand',
            title
          )}
        />
      </Title>
    );
  }

  function renderSegments() {
    if (totalValues === 0) {
      return (
        <Flex overflow="hidden">
          <p>{t('No recent data.')}</p>
        </Flex>
      );
    }

    return (
      <Flex overflow="hidden">
        {topSegments.map((value, index) => {
          const pct = percent(value.count, totalValues);
          const pctLabel = Math.floor(pct);
          const segmentProps = {
            index,
            onClick: () => {
              trackAnalytics('issue_group_details.tags.bar.clicked', {
                tag: title,
                value: value.value,
                platform: project?.platform,
                is_mobile: isMobilePlatform(project?.platform),
                organization,
              });
              return onTagClick?.(title, value);
            },
          };
          return (
            <div
              key={value.isOther ? 'other' : `segment-${value.value}`}
              style={{width: pct + '%'}}
              onMouseOver={() => {
                setHoveredValue(value);
              }}
              onMouseLeave={() => setHoveredValue(null)}
            >
              {value.isOther ? (
                <OtherSegment
                  aria-label={t('Other segment')}
                  color={theme.chart.neutral}
                />
              ) : (
                <Segment
                  aria-label={`${value.value} ${t('segment')}`}
                  color={colors[index]!}
                  {...segmentProps}
                >
                  {/* if the first segment is 6% or less, the label won't fit cleanly into the segment, so don't show the label */}
                  {index === 0 && pctLabel > 6 ? `${pctLabel}%` : null}
                </Segment>
              )}
            </div>
          );
        })}
      </Flex>
    );
  }

  function renderLegend() {
    return (
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            variants={{
              open: {height: ['100%', 'auto'], opacity: 1},
              closed: {height: '0', opacity: 0, overflow: 'hidden'},
            }}
            initial="closed"
            animate="open"
            exit="closed"
          >
            <LegendContainer>
              {topSegments.map((segment, index) => {
                const pctLabel = Math.floor(percent(segment.count, totalValues));
                const unfocus = !!hoveredValue && hoveredValue.value !== segment.value;
                const focus = hoveredValue?.value === segment.value;
                const linkLabel = segment.isOther
                  ? t(
                      'Other %s tag values, %s of all events. View other tags.',
                      title,
                      `${pctLabel}%`
                    )
                  : t(
                      '%s, %s, %s of all events. View events with this tag value.',
                      title,
                      segment.value,
                      `${pctLabel}%`
                    );

                const legend = (
                  <LegendRow
                    onMouseOver={() => setHoveredValue(segment)}
                    onMouseLeave={() => setHoveredValue(null)}
                  >
                    <LegendDot
                      color={segment.isOther ? theme.chart.neutral : colors[index]!}
                      focus={focus}
                    />
                    <Tooltip skipWrapper delay={TOOLTIP_DELAY} title={segment.name}>
                      <LegendText unfocus={unfocus}>
                        {segment.name ?? <Text variant="muted">{t('n/a')}</Text>}
                      </LegendText>
                    </Tooltip>
                    <LegendPercent>{`${pctLabel}%`}</LegendPercent>
                  </LegendRow>
                );

                return (
                  <li key={`segment-${segment.name}-${index}`}>
                    {onTagValueClick ? (
                      <StyledButton
                        aria-label={linkLabel}
                        onClick={() => onTagValueClick?.(title, segment)}
                        priority="link"
                      >
                        {legend}
                      </StyledButton>
                    ) : (
                      <Link to={segment.url} aria-label={linkLabel}>
                        {legend}
                      </Link>
                    )}
                  </li>
                );
              })}
            </LegendContainer>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  const totalVisible = topSegments.reduce((sum, value) => sum + value.count, 0);
  const hasOther = totalVisible < totalValues;

  const query = appendExcludeTagValuesCondition(
    location.query.query,
    title,
    topSegments.map(({value}) => value)
  );
  const excludeTopSegmentsUrl: LocationDescriptor = {
    ...location,
    query: {...location.query, query},
  };

  if (hasOther) {
    topSegments.push({
      isOther: true,
      name: t('Other'),
      value: 'other',
      count: totalValues - totalVisible,
      url: otherUrl ?? excludeTopSegmentsUrl ?? '',
    });
  }

  return (
    <TagSummary>
      <details open aria-expanded={expanded} onClick={e => e.preventDefault()}>
        <StyledSummary>
          <TagHeader onClick={() => setExpanded(!expanded)}>
            {renderTitle()}
            {renderSegments()}
          </TagHeader>
        </StyledSummary>
        {renderLegend()}
      </details>
    </TagSummary>
  );
}

export default TagFacetsDistributionMeter;

const TagSummary = styled('div')`
  margin-bottom: ${space(2)};
`;

const TagHeader = styled('span')`
  cursor: pointer;
`;

const Title = styled('div')`
  display: flex;
  font-size: ${p => p.theme.fontSize.md};
  justify-content: space-between;
  margin-bottom: ${space(0.25)};
  line-height: 1.1;
`;

const TitleType = styled('div')`
  flex: none;
  color: ${p => p.theme.tokens.content.primary};
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.md};
  margin-right: ${space(1)};
  align-self: center;
`;

const TitleDescription = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  text-align: right;
  font-size: ${p => p.theme.fontSize.md};
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  align-self: center;
`;

const OtherSegment = styled('span')<{color: string}>`
  display: block;
  width: 100%;
  height: ${space(2)};
  color: inherit;
  outline: none;
  background-color: ${p => p.color};
`;

const Segment = styled('span', {shouldForwardProp: isPropValid})<{color: string}>`
  &:hover {
    color: ${p => p.theme.white};
  }
  display: block;
  width: 100%;
  height: ${space(2)};
  color: ${p => p.theme.white};
  outline: none;
  background-color: ${p => p.color};
  text-align: right;
  font-size: ${p => p.theme.fontSize.xs};
  padding: 1px ${space(0.5)} 0 0;
  user-select: none;
`;

const LegendContainer = styled('ol')`
  list-style: none;
  padding: 0;
  margin: ${space(1)} 0;
`;

const LegendRow = styled('div')`
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: ${space(0.5)} 0;
`;

const LegendDot = styled('span')<{color: string; focus: boolean}>`
  padding: 0;
  position: relative;
  width: 11px;
  height: 11px;
  text-indent: -9999em;
  display: inline-block;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: ${p => p.color};
  &:after {
    content: '';
    border-radius: 50%;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    outline: ${p => p.theme.colors.gray100} ${space(0.5)} solid;
    opacity: ${p => (p.focus ? '1' : '0')};
    transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
`;

const LegendText = styled('span')<{unfocus: boolean}>`
  font-size: ${p => p.theme.fontSize.sm};
  margin-left: ${space(1)};
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  transition: color 0.3s;
  color: ${p =>
    p.unfocus ? p.theme.tokens.content.muted : p.theme.tokens.content.primary};
`;

const LegendPercent = styled('span')`
  font-size: ${p => p.theme.fontSize.sm};
  margin-left: ${space(1)};
  color: ${p => p.theme.tokens.content.primary};
  text-align: right;
  flex-grow: 1;
`;

const ExpandToggleButton = styled(Button)`
  color: ${p => p.theme.tokens.content.muted};
  margin-left: ${space(0.5)};
`;

const StyledSummary = styled('summary')`
  &::-webkit-details-marker {
    display: none;
  }
`;

const StyledButton = styled(Button)`
  width: 100%;
  > span {
    display: block;
  }
`;
