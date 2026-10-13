import { expandApplicationHtml as expand } from '../../build/application-html.js';

/** Keep existing structure/copy guards independent of additive i18n annotations.
 * Catalog and browser tests separately verify the annotations and translations.
 */
export function expandApplicationHtml(source) {
  return expand(source).replace(
    / data-i18n(?:-(?:title|placeholder|aria-label|alt))?="[^"]*"/g,
    '',
  );
}
