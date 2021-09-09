import styled from '@emotion/styled';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from '../../components/table';

type TypeStyle = {
  fontFamily?: string;
  fontWeight?: number;
  fontSize?: string;
  fontSizeEm?: string;
  lineHeight?: number;
  letterSpacing?: string;
};

type TypeDefinition = {
  name: string;
  /** HTML tag (h1, h2, p) used to render type element */
  tag: keyof JSX.IntrinsicElements;
  style: TypeStyle;
};

type Column = {
  colName: string;
  key?: keyof TypeStyle | keyof TypeDefinition;
  align: 'left' | 'right' | 'center';
  tabularFigures: boolean;
};

const sampleColumn: Column = {
  colName: 'Scale',
  key: 'name',
  align: 'left',
  tabularFigures: false,
};

const styleColumns: Column[] = [
  {
    colName: 'Weight',
    key: 'fontWeight',
    align: 'right',
    tabularFigures: true,
  },
  {
    colName: 'Size (px)',
    key: 'fontSize',
    align: 'right',
    tabularFigures: true,
  },
  {
    colName: 'Size (em)',
    key: 'fontSizeEm',
    align: 'right',
    tabularFigures: true,
  },
  {
    colName: 'Line height',
    key: 'lineHeight',
    align: 'right',
    tabularFigures: true,
  },
  {
    colName: 'Letter spacing',
    key: 'letterSpacing',
    align: 'right',
    tabularFigures: true,
  },
];

const scaleDefinitions: TypeDefinition[] = [
  {
    name: 'Heading 1',
    tag: 'h1',
    style: {
      fontWeight: 600,
      fontSize: '36px',
      fontSizeEm: '2.25em',
      lineHeight: 1.2,
      letterSpacing: '-0.02em',
    },
  },
  {
    name: 'Heading 2',
    tag: 'h2',
    style: {
      fontWeight: 600,
      fontSize: '30px',
      fontSizeEm: '1.875em',
      lineHeight: 1.2,
      letterSpacing: '-0.01em',
    },
  },
  {
    name: 'Heading 3',
    tag: 'h3',
    style: {
      fontWeight: 600,
      fontSize: '26px',
      fontSizeEm: '1.625em',
      lineHeight: 1.2,
      letterSpacing: '-0.008em',
    },
  },
  {
    name: 'Heading 4',
    tag: 'h4',
    style: {
      fontWeight: 600,
      fontSize: '22px',
      fontSizeEm: '1.375em',
      lineHeight: 1.2,
      letterSpacing: 'normal',
    },
  },
  {
    name: 'Heading 5',
    tag: 'h5',
    style: {
      fontWeight: 600,
      fontSize: '20px',
      fontSizeEm: '1.25em',
      lineHeight: 1.2,
      letterSpacing: 'normal',
    },
  },
  {
    name: 'Heading 6',
    tag: 'h6',
    style: {
      fontWeight: 600,
      fontSize: '18px',
      fontSizeEm: '1.125em',
      lineHeight: 1.2,
      letterSpacing: 'normal',
    },
  },
  {
    name: 'Paragraph',
    tag: 'p',
    style: {
      fontWeight: 400,
      fontSize: '16px',
      fontSizeEm: '1em',
      lineHeight: 1.4,
      letterSpacing: 'normal',
    },
  },
  {
    name: 'Button/Label',
    tag: 'p',
    style: {
      fontWeight: 600,
      fontSize: '16px',
      fontSizeEm: '1em',
      lineHeight: 1.2,
      letterSpacing: 'normal',
    },
  },
  {
    name: 'Small',
    tag: 'p',
    style: {
      fontWeight: 400,
      fontSize: '14px',
      fontSizeEm: '0.875em',
      lineHeight: 1.4,
      letterSpacing: '+0.01em',
    },
  },
];

const codeDefinitions: TypeDefinition[] = [
  {
    name: 'Single-line',
    tag: 'p',
    style: {
      fontFamily: 'IBM Plex Mono',
      fontWeight: 400,
      fontSize: '16px',
      fontSizeEm: '1em',
      lineHeight: 1.4,
      letterSpacing: '-0.02em',
    },
  },
  {
    name: 'Multi-line',
    tag: 'p',
    style: {
      fontFamily: 'IBM Plex Mono',
      fontWeight: 400,
      fontSize: '16px',
      fontSizeEm: '1em',
      lineHeight: 2,
      letterSpacing: 'normal',
    },
  },
];

/** Generic component with variable HTML tag name,
 * to be used with @emotion's as prop.
 * See: https://emotion.sh/docs/styled#as-prop
 *   */
const TypeComponent = styled('div')``;

const generateTypeTable =
  (cols: {sampleColumn: Column; styleColumns: Column[]}, definitions: TypeDefinition[]) =>
  () =>
    (
      <Table>
        <TableHead>
          <TableRow>
            {[sampleColumn, ...styleColumns].map(col => (
              <TableHeadCell
                key={col.key}
                align={col.align}
                tabularFigures={col.tabularFigures}
              >
                {col.colName}
              </TableHeadCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {definitions.map(scale => (
            <TableRow key={scale.name}>
              <TableCell
                key={cols.sampleColumn.key}
                align={cols.sampleColumn.align}
                tabularFigures={cols.sampleColumn.tabularFigures}
              >
                <TypeComponent as={scale.tag} style={scale.style}>
                  {scale[cols.sampleColumn.key!]}
                </TypeComponent>
              </TableCell>
              {cols.styleColumns.map(col => (
                <TableCell
                  key={col.key}
                  align={col.align}
                  tabularFigures={col.tabularFigures}
                >
                  {scale.style?.[col.key!]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );

export const ScaleTable = generateTypeTable(
  {sampleColumn, styleColumns},
  scaleDefinitions
);

export const CodeTable = generateTypeTable({sampleColumn, styleColumns}, codeDefinitions);

const tabularFiguresColumns: Column[] = [
  {
    colName: 'Proportional figures',
    align: 'right',
    tabularFigures: false,
  },
  {
    colName: 'Tabular figures',
    align: 'right',
    tabularFigures: true,
  },
];

const tabularFiguresSamples: string[] = ['999,999', '111,111', '9.99999', '1.11111'];

export const TabularFigureTable = () => (
  <Table>
    <TableHead>
      <TableRow>
        {tabularFiguresColumns.map(col => (
          <TableHeadCell
            key={col.colName}
            align={col.align}
            tabularFigures={col.tabularFigures}
          >
            {col.colName}
          </TableHeadCell>
        ))}
      </TableRow>
    </TableHead>
    <TableBody>
      {tabularFiguresSamples.map(sample => (
        <TableRow key={sample}>
          {tabularFiguresColumns.map(col => (
            <TableCell
              key={col.colName}
              align={col.align}
              tabularFigures={col.tabularFigures}
            >
              {sample}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  </Table>
);
