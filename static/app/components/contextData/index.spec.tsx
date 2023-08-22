import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ContextData from 'sentry/components/contextData';
import {castAsMetaContainer} from 'sentry/components/events/meta/metaContainer';

const NO_ELLIPSIS_CASES = [
  // Cases to make sure we are defensively handling various shapes of meta.
  {description: 'missing (no meta prop)', props: {}},
  {description: 'missing (empty meta container)', props: {meta: castAsMetaContainer({})}},
  {
    description: 'missing (empty meta)',
    props: {meta: castAsMetaContainer({'': {}})},
  },
  {
    description: 'missing (null meta)',
    props: {meta: castAsMetaContainer({'': null})},
  },
  {description: 'missing (no len)', props: {meta: castAsMetaContainer({'': {}})}},
] as const;

const ELLIPSIS = '...';

describe('ContextData', function () {
  describe('render()', function () {
    describe('strings', function () {
      const ELLIPSIZED_TEXT = 'ABCDEFGHIJ';
      const TOTAL_LENGTH = ELLIPSIZED_TEXT.length + 1; // 1 unknown character

      it('should render urls w/ an additional <a> link', function () {
        const URL = 'https://example.org/foo/bar/';
        render(<ContextData data={URL} />);

        expect(screen.getByText(URL)).toBeInTheDocument();
        expect(screen.getByRole('link')).toHaveAttribute('href', URL);
      });

      it('should render an ellipsis if string has been truncated (remark = x)', async () => {
        const {container} = render(
          <ContextData
            withAnnotatedText
            data={`${ELLIPSIZED_TEXT}${ELLIPSIS}`}
            meta={castAsMetaContainer({
              '': {
                rem: [
                  [
                    '!limit',
                    'x',
                    ELLIPSIZED_TEXT.length,
                    ELLIPSIZED_TEXT.length + ELLIPSIS.length,
                  ],
                ],
                len: TOTAL_LENGTH,
                chunks: [
                  {
                    type: 'text',
                    text: ELLIPSIZED_TEXT,
                  },
                  {
                    type: 'redaction',
                    text: ELLIPSIS,
                    rule_id: '!limit',
                    remark: 'x',
                  },
                ],
              },
            })}
          />
        );

        expect(screen.getByText(ELLIPSIZED_TEXT)).toBeInTheDocument();
        await userEvent.hover(screen.getByText(`${ELLIPSIS}`));
        expect(
          await screen.findByText(
            `Removed because of size limits. Serialized object has ${TOTAL_LENGTH} characters total.`
          )
        ).toBeInTheDocument();
        expect(container).toSnapshot();
      });
    });

    describe('arrays', function () {
      const ELLIPSIZED_ARRAY = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      const TOTAL_LENGTH = ELLIPSIZED_ARRAY.length + 1; // 1 unknown element

      it('should render an ellipsis if array is longer than meta length', async () => {
        const {container} = render(
          <ContextData
            data={ELLIPSIZED_ARRAY}
            withAnnotatedText
            meta={castAsMetaContainer({'': {len: TOTAL_LENGTH}})}
          />
        );
        for (const value of ELLIPSIZED_ARRAY) {
          expect(screen.getByText(String(value))).toBeInTheDocument();
        }
        await userEvent.hover(screen.getByText(`${ELLIPSIS}`));
        expect(
          await screen.findByText(
            `Removed because of size limits. Collection has ${TOTAL_LENGTH} items total.`
          )
        ).toBeInTheDocument();
        expect(container).toSnapshot();
      });

      [
        ...NO_ELLIPSIS_CASES,
        {
          description: 'equal to string length',
          props: {meta: castAsMetaContainer({'': {len: ELLIPSIZED_ARRAY.length}})},
        },
      ].forEach(({description, props}) => {
        it(`shouldn't render an ellipsis if meta length is ${description}`, function () {
          render(<ContextData data={ELLIPSIZED_ARRAY} withAnnotatedText {...props} />);
          for (const value of ELLIPSIZED_ARRAY) {
            expect(screen.getByText(String(value))).toBeInTheDocument();
          }
          expect(screen.queryByText(ELLIPSIS)).not.toBeInTheDocument();
        });
      });
    });

    describe('objects', function () {
      const ELLIPSIZED_OBJECT = {aaa: '111', bbb: '222', ccc: '333'};
      const TOTAL_LENGTH = Object.keys(ELLIPSIZED_OBJECT).length + 1;

      it('should render an ellipsis if object has more items than meta length', async () => {
        const {container} = render(
          <ContextData
            data={ELLIPSIZED_OBJECT}
            withAnnotatedText
            meta={castAsMetaContainer({'': {len: TOTAL_LENGTH}})}
          />
        );
        for (const [key, value] of Object.entries(ELLIPSIZED_OBJECT)) {
          for (const text of [key, value]) {
            expect(screen.getByText(text)).toBeInTheDocument();
          }
        }
        expect(screen.getByText(ELLIPSIS)).toBeInTheDocument();
        await userEvent.hover(screen.getByText(`${ELLIPSIS}`));
        expect(
          await screen.findByText(
            `Removed because of size limits. Mapping has ${TOTAL_LENGTH} items total.`
          )
        ).toBeInTheDocument();
        expect(container).toSnapshot();
      });

      [
        ...NO_ELLIPSIS_CASES,
        {
          description: 'equal to object length',
          props: {
            meta: castAsMetaContainer({'': {len: Object.keys(ELLIPSIZED_OBJECT).length}}),
          },
        },
      ].forEach(({description, props}) => {
        it(`shouldn't render an ellipsis if meta length is ${description}`, function () {
          render(<ContextData data={ELLIPSIZED_OBJECT} withAnnotatedText {...props} />);
          for (const [key, value] of Object.entries(ELLIPSIZED_OBJECT)) {
            for (const text of [key, value]) {
              expect(screen.getByText(text)).toBeInTheDocument();
            }
          }
          expect(screen.queryByText(ELLIPSIS)).not.toBeInTheDocument();
        });
      });
    });
  });
});
