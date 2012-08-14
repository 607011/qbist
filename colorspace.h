/*
Original Colorspace code by Jörn Loviscach <jl@j3l7h.de>
Port to C++ and optimizations by Oliver Lau <oliver@von-und-fuer-lau.de>
Copyright (c) 1995, 2012 by Jörn Loviscach, Oliver Lau. All rights reserved.
$Id: colorspace.h c0795d2dabcd 2012/02/17 09:29:03 Oliver Lau <oliver@von-und-fuer-lau.de> $
*/

#ifndef __COLORSPACE_H__
#define __COLORSPACE_H__

#include <iostream>
#include <vector>
#include <pthread.h>
#include <math.h>

#undef USE_SIN_TAB


namespace qbist {

#ifdef USE_SIN_TAB
	class ScopedLock {
	public:
		inline ScopedLock(pthread_mutex_t* mutex) : mMutex(mutex) {
			pthread_mutex_lock(mMutex);
		}
		inline ~ScopedLock() {
			pthread_mutex_unlock(mMutex);
		}
	private:
		pthread_mutex_t* mMutex;
	};


	template <typename REAL>
	class Sine
	{
	private:
		Sine(void) {
			for (REAL a = 0; a < 2 * 3.14159265358979323846; a += 1.0/(REAL)kGranularity)
				mSin.push_back(::sin(a));
		}
		~Sine() {
			if (mInstance)
				delete mInstance;
			mInstance = NULL;
		}
		static Sine* mInstance;
		std::vector<REAL> mSin;
		static pthread_mutex_t mMutex;
		static const int kGranularity = 256*256;
	public:
		static Sine* instance(void);
		REAL value(REAL a) const {
			const int i = (int)(kGranularity * a);
			return mSin.at(i % mSin.size());
		}
		static const REAL f;
	};

	template <typename REAL>
	const REAL Sine<REAL>::f = 20.0 / 180.0 * 3.14159265358979323846;

	template <typename REAL>
	pthread_mutex_t Sine<REAL>::mMutex = PTHREAD_MUTEX_INITIALIZER;

	template <typename REAL>
	Sine<REAL>* Sine<REAL>::mInstance = NULL;

	template <typename REAL>
	Sine<REAL>* Sine<REAL>::instance(void)
	{
		ScopedLock locker(&mMutex);
		if (mInstance == NULL)
			mInstance = new Sine<REAL>();
		return mInstance;
	}
#endif


	template <typename REAL>
	class Colorspace {
	private:
		REAL mX;
		REAL mY;
		REAL mZ;

	public:
		explicit Colorspace(void)
			: mX(0)
			, mY(0)
			, mZ(0)
#ifdef USE_SIN_TAB
			, mSin(Sine<REAL>::instance())
#endif
		{ /* ... */ }

#ifdef USE_SIN_TAB
		Sine<REAL>* mSin;
		inline REAL sine(REAL x) { return mSin->value(x); }
#endif

		void set(REAL x, REAL y, REAL z) {
			mX = x;
			mY = y;
			mZ = z;
		}

		inline REAL x(void) const { return mX; }
		inline REAL y(void) const { return mY; }
		inline REAL z(void) const { return mZ; }

		inline uint32_t r(void) const { return uint32_t(0xfe * mX) & 0xff; }
		inline uint32_t g(void) const { return uint32_t(0xfe * mY) & 0xff; }
		inline uint32_t b(void) const { return uint32_t(0xfe * mZ) & 0xff; }

		inline uint32_t rgb(void) const
		{
			return 0xff000000 | (r() << 16) | (g() << 8) | b();
		}

		inline void project(const Colorspace& source, const Colorspace& control)
		{
			const REAL s = source.x() * control.x() + source.y() * control.y() + source.z() * control.z();
			mX = s * source.x();
			mY = s * source.y();
			mZ = s * source.z();

		}

		inline void shift(const Colorspace& source, const Colorspace& control)
		{
			mX = source.x() + control.x();
			mY = source.y() + control.y();
			mZ = source.z() + control.z();
			if (mX >= 1)
				mX -= 1;
			if (mY >= 1)
				mY -= 1;
			if (mZ >= 1)
				mZ -= 1;
		}

		inline void shiftBack(const Colorspace& source, const Colorspace& control)
		{
			mX = source.x() - control.x();
			mY = source.y() - control.y();
			mZ = source.z() - control.z();
			if (mX <= 0)
				mX += 1;
			if (mY <= 0)
				mY += 1;
			if (mZ <= 0)
				mZ += 1;
		}

		inline void rotate(const Colorspace& source)
		{
			mX = source.y();
			mY = source.z();
			mZ = source.x();
		}


		inline void rotate2(const Colorspace& source)
		{
			mX = source.z();
			mY = source.x();
			mZ = source.y();
		}

		inline void multiply(const Colorspace& source, const Colorspace& control)
		{
			mX = source.x() * control.x();
			mY = source.y() * control.y();
			mZ = source.z() * control.z();
		}

		inline void sine(const Colorspace& source, const Colorspace& control)
		{
#ifdef USE_SIN_TAB
			mX = 0.5 + 0.5 * sine(20 * source.x() * control.x());
			mY = 0.5 + 0.5 * sine(20 * source.y() * control.y());
			mZ = 0.5 + 0.5 * sine(20 * source.z() * control.z());
#else
			mX = 0.5 + 0.5 * ::sin(20 * source.x() * control.x());
			mY = 0.5 + 0.5 * ::sin(20 * source.y() * control.y());
			mZ = 0.5 + 0.5 * ::sin(20 * source.z() * control.z());
#endif
		}

		inline void conditional(const Colorspace& source, const Colorspace& control)
		{
			if (control.x() + control.y() + control.z() > 0.5) {
				mX = source.x();
				mY = source.y();
				mZ = source.z();
			}
			else {
				mX = control.x();
				mY = control.y();
				mZ = control.z();
			}
		}

		inline void complement(const Colorspace& source)
		{
			mX = 1 - source.x();
			mY = 1 - source.y();
			mZ = 1 - source.z();
		}

	};

}

#endif // __COLORSPACE_H__
