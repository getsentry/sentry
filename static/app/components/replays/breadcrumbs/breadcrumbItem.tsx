import {
  CSSProperties,
  isValidElement,
  memo,
  MouseEvent,
  useCallback,
  useMemo,
} from 'react';
import styled from '@emotion/styled';
import beautify from 'js-beautify';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import ObjectInspector from 'sentry/components/objectInspector';
import PanelItem from 'sentry/components/panels/panelItem';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import {Extraction} from 'sentry/utils/replays/extractDomNodes';
import getFrameDetails from 'sentry/utils/replays/getFrameDetails';
import type {ReplayFrame} from 'sentry/utils/replays/types';
import {isErrorFrame} from 'sentry/utils/replays/types';
import useProjects from 'sentry/utils/useProjects';
import IconWrapper from 'sentry/views/replays/detail/iconWrapper';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

type MouseCallback = (frame: ReplayFrame, e: React.MouseEvent<HTMLElement>) => void;

interface BaseProps {
  extraction: Extraction | undefined;
  frame: ReplayFrame;
  onClick: null | MouseCallback;
  onMouseEnter: MouseCallback;
  onMouseLeave: MouseCallback;
  startTimestampMs: number;
  className?: string;
  expandPaths?: string[];
  style?: CSSProperties;
}
interface NoDimensionChangeProps extends BaseProps {
  index?: undefined;
  onDimensionChange?: undefined;
}

interface WithDimensionChangeProps extends BaseProps {
  /**
   * Only required if onDimensionChange is used
   */
  index: number;
  onDimensionChange: (
    index: number,
    path: string,
    expandedState: Record<string, boolean>,
    event: MouseEvent<HTMLDivElement>
  ) => void;
}

type Props = NoDimensionChangeProps | WithDimensionChangeProps;

function getCrumbOrFrameData(frame: ReplayFrame) {
  return {
    ...getFrameDetails(frame),
    projectSlug: isErrorFrame(frame) ? frame.data.projectSlug : null,
    timestampMs: frame.timestampMs,
  };
}

function BreadcrumbItem({
  className,
  extraction,
  frame,
  expandPaths,
  index,
  onClick,
  onDimensionChange,
  onMouseEnter,
  onMouseLeave,
  startTimestampMs,
  style,
}: Props) {
  const {color, description, projectSlug, title, icon, timestampMs} =
    getCrumbOrFrameData(frame);

  const handleDimensionChange = useCallback(
    (path, expandedState, e) =>
      onDimensionChange && onDimensionChange(index, path, expandedState, e),
    [index, onDimensionChange]
  );

  return (
    <CrumbItem
      as={onClick ? 'button' : 'span'}
      onClick={e => onClick?.(frame, e)}
      onMouseEnter={e => onMouseEnter(frame, e)}
      onMouseLeave={e => onMouseLeave(frame, e)}
      style={style}
      className={className}
    >
      <IconWrapper color={color} hasOccurred>
        {icon}
      </IconWrapper>
      <CrumbDetails>
        <TitleContainer>
          <Title>{title}</Title>
          {onClick ? (
            <TimestampButton
              startTimestampMs={startTimestampMs}
              timestampMs={timestampMs}
            />
          ) : null}
        </TitleContainer>

        {typeof description === 'string' || isValidElement(description) ? (
          <Description title={description} showOnlyOnOverflow>
            {description}
          </Description>
        ) : (
          <InspectorWrapper>
            <ObjectInspector
              data={description}
              expandPaths={expandPaths}
              onExpand={handleDimensionChange}
              theme={{
                TREENODE_FONT_SIZE: '0.7rem',
                ARROW_FONT_SIZE: '0.5rem',
              }}
            />
          </InspectorWrapper>
        )}

        {extraction?.html ? (
          <CodeContainer>
            <CodeSnippet language="html" hideCopyButton>
              {beautify.html(extraction?.html, {indent_size: 2})}
            </CodeSnippet>
          </CodeContainer>
        ) : null}

        {projectSlug ? <CrumbProject projectSlug={projectSlug} /> : null}
      </CrumbDetails>
    </CrumbItem>
  );
}

function CrumbProject({projectSlug}: {projectSlug: string}) {
  const {projects} = useProjects();
  const project = useMemo(
    () => projects.find(p => p.slug === projectSlug),
    [projects, projectSlug]
  );
  if (!project) {
    return <CrumbProjectBadgeWrapper>{projectSlug}</CrumbProjectBadgeWrapper>;
  }
  return (
    <CrumbProjectBadgeWrapper>
      <ProjectBadge project={project} avatarSize={16} disableLink />
    </CrumbProjectBadgeWrapper>
  );
}

const CrumbProjectBadgeWrapper = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  margin-top: ${space(0.25)};
`;

const InspectorWrapper = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
`;

const CrumbDetails = styled('div')`
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const TitleContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(1)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Title = styled('span')`
  ${p => p.theme.overflowEllipsis};
  text-transform: capitalize;
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 600;
  color: ${p => p.theme.gray400};
  line-height: ${p => p.theme.text.lineHeightBody};
`;

const Description = styled(Tooltip)`
  ${p => p.theme.overflowEllipsis};
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.subText};
`;

const CrumbItem = styled(PanelItem)`
  display: grid;
  grid-template-columns: max-content auto;
  align-items: flex-start;
  gap: ${space(1)};
  width: 100%;

  font-size: ${p => p.theme.fontSizeMedium};
  background: transparent;
  padding: ${space(1)};
  text-align: left;
  border: none;
  position: relative;

  border-radius: ${p => p.theme.borderRadius};

  &:hover {
    background-color: ${p => p.theme.surface200};
  }

  /* Draw a vertical line behind the breadcrumb icon. The line connects each row together, but is truncated for the first and last items */
  &::after {
    content: '';
    position: absolute;
    left: 19.5px;
    width: 1px;
    background: ${p => p.theme.gray200};
    height: 100%;
  }

  &:first-of-type::after {
    top: ${space(1)};
    bottom: 0;
  }

  &:last-of-type::after {
    top: 0;
    height: ${space(1)};
  }

  &:only-of-type::after {
    height: 0;
  }
`;

const CodeContainer = styled('div')`
  margin-top: ${space(1)};
  max-height: 400px;
  max-width: 100%;
  overflow: auto;
`;

export default memo(BreadcrumbItem);
