/**
 * Host half of dsh-code-highlight. All behaviour lives in the Client half
 * (`./client`, declared by package.json `dsh.client`); this row only gives the
 * bundle a mounted Loader entry so the Web shell loads that Client half.
 */
export const name = 'dsh-code-highlight'

export function apply(): void {}
