import styled from '@emotion/styled';

import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import QuestionTooltip from 'sentry/components/questionTooltip';
import SidebarSection from 'sentry/components/sidebarSection';
import Tag from 'sentry/components/tag';
import TextOverflow from 'sentry/components/textOverflow';
import Tooltip from 'sentry/components/tooltip';
import space from 'sentry/styles/space';

export default {
  title: 'Views/Sidebar Section',
  component: SidebarSection,
  argTypes: {
    title: {control: {type: 'text'}},
    icon: {
      control: {type: 'boolean'},
    },
  },
};

export const Default = ({title, icon}) => (
  <SidebarSection
    title={title}
    icon={
      icon && <QuestionTooltip position="top" title="Tooltip description" size="sm" />
    }
  >
    {'16 hours'}
  </SidebarSection>
);

Default.storyName = 'With text';
Default.parameters = {
  docs: {
    description: {
      story: 'Generic sidebar section with text.',
    },
  },
};
Default.args = {
  title: 'Subheading',
  icon: false,
};

export const WithIconTagsText = ({title, icon}) => (
  <SidebarSection
    title={title}
    icon={
      icon && <QuestionTooltip position="top" title="Tooltip description" size="sm" />
    }
  >
    <div>
      <Tooltip title="Tooltip description" isHoverable>
        <Tag type="default">{'Adopted'}</Tag>
      </Tooltip>
      <Environment>{'in production'}</Environment>
    </div>
  </SidebarSection>
);

WithIconTagsText.storyName = 'With Icon, Tags, and Text';
WithIconTagsText.parameters = {
  docs: {
    description: {
      story: 'Sidebar section that has an icon, tag, and text.',
    },
  },
};
WithIconTagsText.args = {
  title: 'Icon, Tag, and Text',
  icon: true,
};

export const WithRows = ({title, icon}) => (
  <SidebarSection
    title={title}
    icon={
      icon && <QuestionTooltip position="top" title="Tooltip description" size="sm" />
    }
  >
    <KeyValueTable>
      <KeyValueTableRow
        keyName="Created"
        value={<StyledTextOverflow>{'Nov 17, 2021 5:36 PM'}</StyledTextOverflow>}
      />
      <KeyValueTableRow
        keyName="Version"
        value={<StyledTextOverflow>{'3.3.3'}</StyledTextOverflow>}
      />
      <KeyValueTableRow
        keyName="Package"
        value={<StyledTextOverflow>{'frontend'}</StyledTextOverflow>}
      />
      <KeyValueTableRow
        keyName="First Event"
        value={<StyledTextOverflow>{'\u2014'}</StyledTextOverflow>}
      />
      <KeyValueTableRow
        keyName="Last Event"
        value={<StyledTextOverflow>{'\u2014'}</StyledTextOverflow>}
      />
      <KeyValueTableRow
        keyName="Source Maps"
        value={<StyledTextOverflow>{'333 artifacts'}</StyledTextOverflow>}
      />
    </KeyValueTable>
  </SidebarSection>
);

WithRows.storyName = 'With Multiple Rows';
WithRows.parameters = {
  docs: {
    description: {
      story:
        'Section of the sidebar with multiple rows using the KeyValueTable component (label with date, etc).',
    },
  },
};
WithRows.args = {
  title: 'With Multiple Rows',
  icon: false,
};

const Environment = styled('span')`
  color: ${p => p.theme.textColor};
  margin-left: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StyledTextOverflow = styled(TextOverflow)`
  line-height: inherit;
  text-align: right;
`;
