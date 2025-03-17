import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Props = {
  platform: string;
};

const DOC_COMPONENTS = {
  'sentry.python': PythonDocs,
  'sentry.javascript.node': NodeDocs,
  'sentry.javascript.react-native': ReactNativeDocs,
};

function InlineDocs({platform}: Props) {
  if (!platform) {
    return null;
  }

  const componentKey = Object.keys(DOC_COMPONENTS).find(key => platform.startsWith(key));
  const DocComponent = componentKey
    ? DOC_COMPONENTS[componentKey as keyof typeof DOC_COMPONENTS]
    : null;

  return (
    <div>
      <h4>{t('Requires Manual Instrumentation')}</h4>
      {DocComponent ? (
        <DocComponent />
      ) : (
        <p>
          {tct(
            `To manually instrument certain regions of your code, view [docLink:our documentation].`,
            {
              docLink: (
                <ExternalLink href="https://docs.sentry.io/product/performance/getting-started/" />
              ),
            }
          )}
        </p>
      )}
    </div>
  );
}

function PythonDocs() {
  return (
    <DocumentationWrapper>
      <p>
        {tct(
          "The Sentry SDK for Python does a very good job of auto instrumenting your application. Here is a short introduction on how to do custom performance instrumentation. If you'd like to learn more, read our [link:custom instrumentation] documentation.",
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/python/tracing/instrumentation/custom-instrumentation/" />
            ),
          }
        )}
      </p>
      <p>
        <strong>{t('Adding a Transaction')}</strong>
      </p>
      <p>
        {t(
          'Adding transactions will allow you to instrument and capture certain regions of your code.'
        )}
      </p>
      <p>
        {t(
          "If you're using one of Sentry's SDK integrations, transactions will be created for you automatically."
        )}
      </p>
      <p>
        {tct(
          'The following example creates a transaction for an expensive operation (in this case, [code:eat_pizza]), and then sends the result to Sentry:',
          {code: <code />}
        )}
      </p>
      <StyledCodeSnippet language="python" dark>
        {`import sentry_sdk

def eat_slice(slice):
    ...

def eat_pizza(pizza):
    with sentry_sdk.start_transaction(op="task", name="Eat Pizza"):
        while pizza.slices > 0:
            eat_slice(pizza.slices.pop())
`}
      </StyledCodeSnippet>
      <p>
        <strong>{t('Adding More Spans to the Transaction')}</strong>
      </p>
      <p>
        {t(
          'If you want to have more fine-grained performance monitoring, you can add child spans to your transaction, which can be done by either:'
        )}
      </p>
      <List
        symbol="bullet"
        css={css`
          margin-bottom: ${space(3)};
        `}
      >
        <ListItem>{t('Using a context manager or')}</ListItem>
        <ListItem>
          {t('Using a decorator, (this works on sync and async functions)')}
        </ListItem>
      </List>
      <p>
        {tct(
          'Calling a [code:sentry_sdk.start_span()] will find the current active transaction and attach the span to it.',
          {code: <code />}
        )}
      </p>
      <StyledCodeSnippet language="python" dark>
        {`import sentry_sdk

def eat_slice(slice):
...

def eat_pizza(pizza):
    with sentry_sdk.start_transaction(op="task", name="Eat Pizza"):
        while pizza.slices > 0:
            with sentry_sdk.start_span(description="Eat Slice"):
                eat_slice(pizza.slices.pop())
`}
      </StyledCodeSnippet>
      <StyledCodeSnippet language="python" dark>
        {`import sentry_sdk

@sentry_sdk.trace
def eat_slice(slice):
    ...

def eat_pizza(pizza):
    with sentry_sdk.start_transaction(op="task", name="Eat Pizza"):
        while pizza.slices > 0:
            eat_slice(pizza.slices.pop())
`}
      </StyledCodeSnippet>
      <p>
        {tct(
          `For in-depth instructions on setting up tracing, view [docLink:our documentation].`,
          {
            docLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/python/tracing/" />
            ),
          }
        )}
      </p>
    </DocumentationWrapper>
  );
}

function NodeDocs() {
  return (
    <DocumentationWrapper>
      <p>
        {t(
          'To manually instrument a specific region of your code, you can create a transaction to capture it.'
        )}
      </p>
      <p>
        {tct(
          'The following example creates a transaction for a part of the code that contains an expensive operation (for example, [code:processItem]), and sends the result to Sentry:',
          {code: <code />}
        )}
      </p>
      <StyledCodeSnippet language="javascript" dark>
        {`app.use(function processItems(req, res, next) {
  const item = getFromQueue();
  const transaction = Sentry.startTransaction({
    op: "task",
    name: item.getTransaction(),
  });

  // processItem may create more spans internally (see next examples)
  processItem(item, transaction).then(() => {
    transaction.finish();
    next();
  });
});
`}
      </StyledCodeSnippet>
      <p>
        {tct(
          `For in-depth instructions on setting up tracing, view [docLink:our documentation].`,
          {
            docLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/node/tracing/instrumentation/custom-instrumentation/" />
            ),
          }
        )}
      </p>
    </DocumentationWrapper>
  );
}

function ReactNativeDocs() {
  return (
    <DocumentationWrapper>
      <p>
        {t(
          'To manually instrument a specific region of your code, you can create a transaction to capture it.'
        )}
      </p>
      <StyledCodeSnippet language="javascript" dark>
        {`const transaction = Sentry.startTransaction({ name: "test-transaction" });
const span = transaction.startChild({ op: "functionX" }); // This function returns a Span
// functionCallX
span.finish(); // Remember that only finished spans will be sent with the transaction
transaction.finish(); // Finishing the transaction will send it to Sentry
`}
      </StyledCodeSnippet>
      <p>
        {tct(
          `For in-depth instructions on setting up tracing, view [docLink:our documentation].`,
          {
            docLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/react-native/tracing/instrumentation/custom-instrumentation/" />
            ),
          }
        )}
      </p>
    </DocumentationWrapper>
  );
}

const DocumentationWrapper = styled('div')`
  p {
    line-height: 1.5;
  }
`;

const StyledCodeSnippet = styled(CodeSnippet)`
  margin-bottom: ${space(3)};
`;

export default InlineDocs;
