import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const LOCALES = ['de', 'en', 'es', 'fr', 'ja', 'pt', 'ru', 'zh']

describe('locale parity', () => {
    it('ships the same keys in all 8 locales', () => {
        expect(readdirSync('locale').sort()).toEqual(LOCALES.map((l) => `${l}.json`))
        const keys = (l: string) => JSON.stringify(Object.keys(JSON.parse(readFileSync(`locale/${l}.json`, 'utf8')).meta).sort())
        for (const l of LOCALES) expect(keys(l)).toBe(keys('en'))
    })
})
