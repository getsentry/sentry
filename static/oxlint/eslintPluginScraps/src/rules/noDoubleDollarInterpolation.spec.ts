import {RuleTester} from '@typescript-eslint/rule-tester';

import {noDoubleDollarInterpolation} from './noDoubleDollarInterpolation';

const ruleTester = new RuleTester();

ruleTester.run('no-double-dollar-interpolation', noDoubleDollarInterpolation, {
  valid: [
    {
      code: 'const C = styled.div`gap: ${p => p.theme.space.md};`;',
      filename: 'file.tsx',
    },
    {
      code: 'const c = css`color: ${p => p.theme.red};`;',
      filename: 'file.tsx',
    },
    {
      code: 'const C = styled(Base)`padding: ${gap} ${other};`;',
      filename: 'file.tsx',
    },
    {
      code: 'const price = `$${amount}`;',
      filename: 'file.tsx',
    },
    {
      code: 'const C = styled.div`content: "\\$"${x};`;',
      filename: 'file.tsx',
    },
  ],

  invalid: [
    {
      code: "const C = styled.div`gap: $${p => p.theme.space['2xl']};`;",
      filename: 'file.tsx',
      errors: [{messageId: 'doubleDollar'}],
      output: "const C = styled.div`gap: ${p => p.theme.space['2xl']};`;",
    },
    {
      code: 'const c = css`color: $${p => p.theme.red};`;',
      filename: 'file.tsx',
      errors: [{messageId: 'doubleDollar'}],
      output: 'const c = css`color: ${p => p.theme.red};`;',
    },
    {
      code: 'const C = styled(Base)`margin: ${a}; padding: $${b};`;',
      filename: 'file.tsx',
      errors: [{messageId: 'doubleDollar'}],
      output: 'const C = styled(Base)`margin: ${a}; padding: ${b};`;',
    },
    {
      code: 'const C = styled.div`gap: $${a}; width: $${b};`;',
      filename: 'file.tsx',
      errors: [{messageId: 'doubleDollar'}, {messageId: 'doubleDollar'}],
      output: 'const C = styled.div`gap: ${a}; width: ${b};`;',
    },
  ],
});
