//Encapsulation of a Fourier Series. No global variables are used; The constructor specifies everything

class FourierSeries {

    // The [0,1]-periodic function to be approximated is specified via samples of real x-values and complex y-values
    // The number of fourier coefficients to use is determined as 2*n+1 (i.e. the exponents will be -n,..,-1,0,1,..,n)
    // dx is the step with which the Riemann integral is approximated
    constructor(n, samplesX, samplesY, dx) {
        this.n = n;
        this.samplesX = samplesX;
        this.samplesY = samplesY;
        this.dx = dx;
        this.coefficients = [];
        this.exponents = [];
        this.buildSeries();
    }

    // Returns the i-th Fourier series coefficient of a periodic function on [0,1], where -inf < i < inf
    fourierCoefficient(i) {
        if ((this.samplesX.length == 0) || (this.samplesX.length != this.samplesY.length))
            return null;
        // If only one point is provided, extend f to a constant function by pushing a second sample
        if (this.samplesX.length == 1) {
            this.samplesX.push(samplesX[0] + 0.01);
            this.samplesY.push(samplesY[0]);
        }
        var samplesIndex = 1;
        var samplesMaxIndex = this.samplesX.length-1;
        var x = 0;
        var sum = Complex(0);
        var summand = Complex(0);
        // Compute the Riemann sum over [0,1] with dx=resolution of the approximation
        while (x < 1) {
            // find the value in samplesX that's nearest to x
            while ((samplesIndex != samplesMaxIndex) && (this.samplesX[samplesIndex] < x))
                samplesIndex++;
            // Linearly interpolate the value of f(x) and discretize the Riemann sum
            var interpolatedYre = this.samplesY[samplesIndex-1].re + (x - this.samplesX[samplesIndex-1])*
                (this.samplesY[samplesIndex].re - this.samplesY[samplesIndex-1].re) / (this.samplesX[samplesIndex] - this.samplesX[samplesIndex-1]);
            var interpolatedYim = this.samplesY[samplesIndex-1].im + (x - this.samplesX[samplesIndex-1])*
                (this.samplesY[samplesIndex].im - this.samplesY[samplesIndex-1].im) / (this.samplesX[samplesIndex] - this.samplesX[samplesIndex-1]);
            summand = (Complex({re: 0, im: -i*2*Math.PI*x}).exp()).mul(new Complex(interpolatedYre, interpolatedYim)).mul(this.dx);
            sum = sum.add(summand);
            x += this.dx;
        }
        return sum;
    }

    // Builds the Fourier series by storing the coefficients and associated exponents in this.coefficients and this.exponents
    buildSeries() {
        this.coefficients = [];
        this.exponents = [];

        var coeff = this.fourierCoefficient(0,this.samplesX,this.samplesY);
        this.coefficients.push(coeff);
        this.exponents.push(0);

        for (var i = 1; i <= this.n; i++) {
            coeff = this.fourierCoefficient(i,this.samplesX,this.samplesY);
            this.coefficients.push(coeff);
            this.exponents.push(i);
            coeff = this.fourierCoefficient(-i,this.samplesX,this.samplesY);
            this.coefficients.push(coeff);
            this.exponents.push(-i);
        }
    }

    // Returns a list of complex numbers corresponding to the evaluated summands of the Fourier series at x
    getVectors(x) {
        var vectors = [];
        for (var i = 0; i < this.coefficients.length; i++) 
            vectors.push((Complex({re: 0, im: this.exponents[i]*2*Math.PI*x}).exp()).mul(this.coefficients[i]));
        return vectors;
    }

    // Builds the evaluated summands of the series at x and sums them up
    evaluateFourierSeries(x) {
        var sum = Complex(0);
        var vectors = this.getVectors(x);
        for (var i = 0; i < vectors.length; i++)
            sum = sum.add(vectors[i]);
        return sum;
    }

    sortByMagnitude() {
        if (this.n < 1)
            return null;
        var index = 1;
        while (index < this.coefficients.length) {

            var lowestIndex = index;
            for (var i = index + 1; i < this.coefficients.length; i++) {
                if (this.coefficients[i].abs() > this.coefficients[lowestIndex].abs())
                    lowestIndex = i;
            }

            var tmp = this.coefficients[index].clone();
            this.coefficients[index] = this.coefficients[lowestIndex].clone();
            this.coefficients[lowestIndex] = tmp;

            var tmp2 = this.exponents[index];
            this.exponents[index] = this.exponents[lowestIndex];
            this.exponents[lowestIndex] = tmp2;

            index++;
        }

    }
}