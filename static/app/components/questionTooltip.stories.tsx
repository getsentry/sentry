import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import QuestionTooltip from 'sentry/components/questionTooltip';
import * as Storybook from 'sentry/stories';
import {space} from 'sentry/styles/space';

export default Storybook.story('QuestionTooltip', story => {
  story('Basics', () => {
    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="QuestionTooltip" /> component is a small{' '}
          <Storybook.JSXNode name="IconQuestion" /> where you can specify a tooltip to go
          with it. It is useful for placing after headers and titles to include additional
          information. You'll see it often at the top of Sentry's pages, near the page
          titles.
        </p>
        <p>
          An example <Storybook.JSXNode name="QuestionTooltip" /> looks like this:
        </p>
        <Flex align="center" gap="xs">
          <h3 style={{margin: 0}}>Most Dead Clicks</h3>
          <QuestionTooltip
            size="lg"
            position="top"
            title="The top selectors your users have dead clicked on (i.e., a user click that does not result in any page activity after 7 seconds)."
            isHoverable
          />
        </Flex>
        <p>
          Required props are <Storybook.JSXProperty name="size" value />, which specifies
          the size of the icon, and
          <Storybook.JSXProperty name="title" value />, which specifies the tooltip
          content.
        </p>
      </Fragment>
    );
  });

  story('size', () => {
    return (
      <Fragment>
        <p>
          The <Storybook.JSXProperty name="size" value /> prop specifies the size of the
          icon. Remember to keep the size relative to the text or content it is near.
          Valid values are
        </p>
        <IconExamples>
          <div>
            "xs" <QuestionTooltip size="xs" title="xs" />
          </div>
          <div>
            "sm" <QuestionTooltip size="sm" title="sm" />
          </div>
          <div>
            "md" <QuestionTooltip size="md" title="md" />
          </div>
          <div>
            "lg" <QuestionTooltip size="lg" title="lg" />
          </div>
          <div>
            "xl" <QuestionTooltip size="xl" title="xl" />
          </div>
          <div>
            "2xl" <QuestionTooltip size="2xl" title="2xl" />
          </div>
        </IconExamples>
      </Fragment>
    );
  });

  story('Additional props', () => {
    return (
      <Fragment>
        <p>
          Optionally, you can also specify a few other{' '}
          <Storybook.JSXNode name="Tooltip" /> props:
        </p>
        <ul>
          <li>
            <Storybook.JSXProperty name="containerDisplayMode" value />
          </li>
          <li>
            <Storybook.JSXProperty name="isHoverable" value />
          </li>
          <li>
            <Storybook.JSXProperty name="overlayStyle" value />
          </li>
          <li>
            <Storybook.JSXProperty name="position" value />
          </li>
        </ul>
        <p>All the standard values for these props apply.</p>
      </Fragment>
    );
  });
});

const IconExamples = styled('div')`
  display: grid;
  gap: ${space(1)};
`;
