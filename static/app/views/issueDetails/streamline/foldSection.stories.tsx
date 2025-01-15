import {Fragment} from 'react';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import {IconAdd, IconCopy, IconSubtract} from 'sentry/icons';
import storyBook from 'sentry/stories/storyBook';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';

export default storyBook('FoldSection', story => {
  story('Usage', () => (
    <Fragment>
      <CodeSnippet language="jsx">
        {`import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';

<FoldSection title="My Section" sectionKey={SectionKey.MY_SECTION}>
  <MySectionComponent />
</FoldSection>`}
      </CodeSnippet>
      <p>
        The <code>SectionKey</code> required in props is used to create a local storage
        state key to remember the users previous state for the fold section.
      </p>
    </Fragment>
  ));

  story('Default example', () => {
    return (
      <Fragment>
        <FoldSection title="Default Section" sectionKey={SectionKey.HIGHLIGHTS}>
          <Lorem />
        </FoldSection>
        <CodeSnippet language="jsx">
          {`<FoldSection title="Default Section" sectionKey={SectionKey.MY_SECTION}>
  <p>Lorem ipsum...</p>
</FoldSection>`}
        </CodeSnippet>
      </Fragment>
    );
  });

  story('Preventing user from collapsing the section', () => {
    return (
      <Fragment>
        <FoldSection
          title="Prevent Collapse Section"
          sectionKey={SectionKey.HIGHLIGHTS}
          preventCollapse
        >
          <Lorem />
        </FoldSection>
        <CodeSnippet language="jsx">
          {`<FoldSection title="Prevent Collapse Section" sectionKey={SectionKey.MY_SECTION} preventCollapse>
  <p>Lorem ipsum...</p>
</FoldSection>`}
        </CodeSnippet>
      </Fragment>
    );
  });

  story('Custom headers/titles for the section', () => {
    return (
      <Fragment>
        <FoldSection
          title={<span style={{color: 'rebeccapurple'}}>Custom Title</span>}
          sectionKey={SectionKey.HIGHLIGHTS}
        >
          <Lorem />
        </FoldSection>
        <FoldSection
          title="Header with Actions"
          actions={
            <ButtonBar gap={1}>
              <Button size="xs" icon={<IconAdd />}>
                Add
              </Button>
              <Button size="xs" icon={<IconSubtract />}>
                Remove
              </Button>
              <Button size="xs" icon={<IconCopy />}>
                Copy
              </Button>
            </ButtonBar>
          }
          sectionKey={SectionKey.HIGHLIGHTS}
        >
          <Lorem />
        </FoldSection>
        <CodeSnippet language="jsx">
          {`<FoldSection title={<CustomTitle />} actions={<ButtonBar />} sectionKey={SectionKey.MY_SECTION}>
  <p>Lorem ipsum...</p>
</FoldSection>`}
        </CodeSnippet>
      </Fragment>
    );
  });

  story('Collapsing the section by default', () => {
    return (
      <Fragment>
        <p>
          Important Note: Users local storage preferences overwrite this prop, if they
          have manually opened this section before, it will stay open and ignore this
          prop.
        </p>
        <FoldSection
          title="Initially Collapsed Section"
          sectionKey={SectionKey.HIGHLIGHTS}
          initialCollapse
        >
          <Lorem />
        </FoldSection>
        <CodeSnippet language="jsx">
          {`<FoldSection title="Initially Collapsed Section" sectionKey={SectionKey.MY_SECTION} initialCollapse>
  <p>Lorem ipsum...</p>
</FoldSection>`}
        </CodeSnippet>
      </Fragment>
    );
  });
});

function Lorem() {
  return (
    <Fragment>
      <p>
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Corrupti expedita unde
        exercitationem tempora non recusandae sapiente aspernatur, culpa perferendis
        illum? Facere cupiditate soluta eligendi aliquam labore ratione corrupti inventore
        delectus.
      </p>
      <p>
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Recusandae suscipit nihil
        eaque earum minus, optio officia, nam nemo error harum, cupiditate cum odio
        debitis rerum quod maiores ipsa quia nobis? Lorem, ipsum dolor sit amet
        consectetur adipisicing elit. Dignissimos, similique reiciendis aliquid eius
        corrupti eum magni in dolores deleniti sequi maxime assumenda numquam blanditiis
        magnam fuga quo tempore ipsum ducimus! Lorem ipsum dolor sit amet consectetur
        adipisicing elit. Repellendus tempore optio architecto, dignissimos assumenda
        quasi reiciendis in earum hic quae quidem deserunt dolorum aut, sint impedit
        distinctio totam. Ullam, veniam?
      </p>
    </Fragment>
  );
}
