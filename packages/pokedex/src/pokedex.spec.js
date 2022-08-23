describe('', () => {
    it('should flake 1/3 of the time', () => {
        const num = Math.random()*10;
        expect(num).toBeGreaterThan(3);
    });  

    it('should take a long time to finish', async () => {
        await new Promise(res => setTimeout(() => {
            expect(true).toBe(true)
            res()
        }, 4999))
    })
})